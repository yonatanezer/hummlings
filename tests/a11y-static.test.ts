import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** The opening tag of every `<Pressable ...>` in a source file (braces are balanced, so `=>` and nested JSX in props do not end the tag early). */
function pressableTags(src: string): string[] {
  const tags: string[] = [];
  let from = 0;
  for (;;) {
    const i = src.indexOf('<Pressable', from);
    if (i < 0) return tags;
    let depth = 0;
    let j = i + 10;
    for (; j < src.length; j++) {
      const ch = src[j]!;
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (ch === '>' && depth === 0 && src[j - 1] !== '=') break;
    }
    tags.push(src.slice(i, j + 1));
    from = j + 1;
  }
}

const files = ['src/screens', 'src/ui'].flatMap((d) => readdirSync(d).filter((f) => f.endsWith('.tsx')).map((f) => join(d, f)));

describe('accessibility (static)', () => {
  it('gives every Pressable a role, so a screen reader announces it as a button', () => {
    const bad: string[] = [];
    for (const f of files) for (const tag of pressableTags(readFileSync(f, 'utf8'))) if (!tag.includes('accessibilityRole')) bad.push(`${f}: ${tag.slice(0, 70).replace(/\s+/g, ' ')}`);
    expect(bad).toEqual([]);
  });

  it('gives every icon-only Pressable a label (a picture alone says nothing to a screen reader)', () => {
    const bad: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const tag of pressableTags(src)) {
        // a Pressable that holds only an <Icon> (no text next to it) needs accessibilityLabel
        const after = src.slice(src.indexOf(tag) + tag.length, src.indexOf(tag) + tag.length + 260);
        const iconOnly = /^\s*<Icon\b/.test(after) && !/<Text\b/.test(after.split('</Pressable>')[0] ?? '');
        if (iconOnly && !tag.includes('accessibilityLabel')) bad.push(`${f}: ${tag.slice(0, 70).replace(/\s+/g, ' ')}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('keeps the system text scale capped (large text must not break the layouts)', () => {
    expect(readFileSync('App.tsx', 'utf8')).toContain('maxFontSizeMultiplier');
  });
});
