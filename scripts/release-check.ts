// Prints READY only when no placeholder, dev tool or missing asset remains. Run: npm run release:check
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PRIVACY_URL, SUPPORT_URL } from '../src/app/config';
import { loadStages } from './qa-lib';

const results: { name: string; ok: boolean; note?: string }[] = [];
const check = (name: string, ok: boolean, note?: string) => results.push({ name, ok, note });
const md5 = (f: string) => createHash('md5').update(readFileSync(f)).digest('hex').slice(0, 10);
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));

async function main() {
  // 1. template assets replaced
  const template: Record<string, string> = { 'assets/icon.png': 'cb975bba22', 'assets/splash-icon.png': '97dae5a0e6', 'assets/android-icon-foreground.png': '72e71a9c84', 'assets/android-icon-background.png': '2d65569cc0', 'assets/android-icon-monochrome.png': '1e097dab98', 'assets/favicon.png': 'd9f444efbd' };
  for (const [f, h] of Object.entries(template)) check(`asset replaced: ${f}`, existsSync(f) && md5(f) !== h);
  check('store feature graphic exists', existsSync('assets/store/feature.png'));
  // 2. config
  const app = JSON.parse(readFileSync('app.json', 'utf8')).expo;
  check('app.json: name, ids, landscape', app.name === 'Hummlings' && app.ios?.bundleIdentifier === 'com.yonatanezer.hummlings' && app.android?.package === 'com.yonatanezer.hummlings' && app.orientation === 'landscape');
  check('no microphone / storage permissions', (app.android?.blockedPermissions ?? []).includes('android.permission.RECORD_AUDIO'));
  const eas = existsSync('eas.json') ? JSON.parse(readFileSync('eas.json', 'utf8')) : { build: {} };
  check('eas.json has development, preview, production', ['development', 'preview', 'production'].every((k) => k in eas.build));
  // 3. placeholders and dev tools
  const src = walk('src').concat(['App.tsx']).filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes('loopAssets'));
  const bad = src.filter((f) => /TODO|FIXME|lorem ipsum|XXX|console\.log/i.test(readFileSync(f, 'utf8')));
  check('no TODO / FIXME / console.log in src', bad.length === 0, bad.join(', '));
  check('dev overlay hidden in production', readFileSync('src/ui/DevOverlay.tsx', 'utf8').includes('__DEV__'));
  const pur = readFileSync('src/app/purchases.ts', 'utf8');
  check('mock store only in dev/web', pur.includes('__DEV__') && pur.includes("'web'"));
  // 4. content and assets
  const stages = loadStages();
  const files = stages.flatMap((s) => [...s.creatures.map((c) => c.loopFile), ...s.combos.map((c) => c.bonusLoopFile), s.ambienceFile]);
  const missing = files.filter((f) => !existsSync(`assets/loops/${f}`));
  check(`all ${files.length} loop files exist`, missing.length === 0, missing.join(', '));
  check('sfx files exist', ['pop', 'pickup', 'mute', 'unmute', 'remove', 'goal', 'combo', 'snare', 'tick', 'tick_accent'].every((k) => existsSync(`assets/sfx/${k}.m4a`)));
  const mb = walk('assets').filter((f) => !f.includes('sources') && !f.includes('store')).reduce((a, f) => a + statSync(f).size, 0) / 1048576;
  check(`assets ${mb.toFixed(1)} MB (budget 60 MB download)`, mb < 50);
  // 5. store kit and docs
  for (const f of ['STORE_LISTING.md', 'STORE_ANSWERS.md', 'LESSONS.md', 'TODO_FOR_YONATAN.md', 'docs/ORIGINALITY.md', 'pages/hummlings/privacy.html', 'pages/hummlings/support.html']) check(`file exists: ${f}`, existsSync(f));
  // 6. published pages (needs network)
  for (const url of [PRIVACY_URL, SUPPORT_URL]) {
    const ok = await fetch(url, { signal: AbortSignal.timeout(8000) }).then((r) => r.ok, () => false);
    check(`page is live: ${url}`, ok, ok ? undefined : 'merge https://github.com/yonatanezer/app-pages/pull/1');
  }
  // 7. device test confirmed by the owner
  check('device checklist passed (docs/DEVICE_CHECK_PASSED.txt)', existsSync('docs/DEVICE_CHECK_PASSED.txt'), 'run the checklist in TODO_FOR_YONATAN.md on a phone, then create this file');
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${!r.ok && r.note ? `  -> ${r.note}` : ''}`);
  const failed = results.filter((r) => !r.ok);
  console.log(failed.length ? `\nNOT READY (${failed.length} open)` : '\nREADY');
  process.exit(failed.length ? 1 : 0);
}
void main();
