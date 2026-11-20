# Hummlings: build, install, launch and measure on the phone connected by USB (Windows PowerShell).
# Usage (from the repo root, e.g. C:\h):
#   .\scripts\device-check.ps1                 # release build (use this for FPS numbers)
#   .\scripts\device-check.ps1 -Dev            # dev build through Expo (fast look, NOT for FPS)
#   .\scripts\device-check.ps1 -SkipBuild      # only install the last APK, launch, measure
#   .\scripts\device-check.ps1 -Seconds 30     # how long you play while it measures
# Results go to scripts\out\device\<timestamp>\ : commit.txt, screenshot-*.png, gfxinfo.txt, logcat.txt, summary.txt.
# Nothing here changes source code. Untested on a real PC when written: if a step fails, the message says which one.
param(
  [switch]$Dev,
  [switch]$SkipBuild,
  [int]$Seconds = 20
)

$ErrorActionPreference = 'Stop'
$pkg = 'com.yonatanezer.hummlings'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$out = Join-Path $root "scripts\out\device\$stamp"
New-Item -ItemType Directory -Force -Path $out | Out-Null

function Step($msg) { Write-Host "`n== $msg" -ForegroundColor Cyan }
function Fail($msg) { Write-Host "FAILED: $msg" -ForegroundColor Red; exit 1 }

# ---- 1. tools ----
Step 'Looking for adb and Java'
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$platformTools = Join-Path $sdk 'platform-tools'
if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
  if (Test-Path (Join-Path $platformTools 'adb.exe')) { $env:Path += ";$platformTools" } else { Fail "adb not found. Install Android Studio, or add $platformTools to PATH." }
}
if (-not $env:JAVA_HOME) {
  $jbr = @("$env:ProgramFiles\Android\Android Studio\jbr", "$env:LOCALAPPDATA\Programs\Android Studio\jbr") | Where-Object { Test-Path "$_\bin\java.exe" } | Select-Object -First 1
  if ($jbr) { $env:JAVA_HOME = $jbr; $env:Path += ";$jbr\bin" } else { Fail 'JAVA_HOME is not set and Android Studio JBR was not found.' }
}
# the audio library's download script runs under Git bash and needs mkdir/dirname/rm
$gitUsr = 'C:\Program Files\Git\usr\bin'
if (Test-Path $gitUsr) { $env:Path = "$gitUsr;$env:Path" }

# ---- 2. device ----
Step 'Checking the phone'
$devices = (& adb devices) | Select-Object -Skip 1 | Where-Object { $_ -match '\tdevice$' }
if (-not $devices) { Fail "No authorised device. Plug in the phone, enable USB debugging, accept the prompt on the phone, then run 'adb devices'." }
Write-Host ($devices -join "`n")

# ---- 3. which code ----
Step 'Which code is this?'
$branch = (& git rev-parse --abbrev-ref HEAD).Trim()
$commit = (& git log --oneline -1).Trim()
$dirty = (& git status --porcelain)
"$branch`n$commit`n$(if ($dirty) { 'UNCOMMITTED CHANGES:' ; $dirty } else { 'clean tree' })" | Tee-Object -FilePath (Join-Path $out 'commit.txt')

# ---- 4. build and install ----
$apk = $null
if (-not $SkipBuild) {
  if ($Dev) {
    Step 'Dev build through Expo (installs and starts Metro; leave this window open afterwards)'
    & npx expo run:android
    if ($LASTEXITCODE -ne 0) { Fail 'expo run:android' }
  } else {
    Step 'Release build (first time takes 10-20 minutes)'
    Push-Location (Join-Path $root 'android')
    & .\gradlew.bat app:assembleRelease -x lintVitalRelease -PreactNativeArchitectures=arm64-v8a
    $code = $LASTEXITCODE
    Pop-Location
    if ($code -ne 0) { Fail 'gradle assembleRelease (see the output above; send me the "What went wrong" block)' }
  }
}
if (-not $Dev) {
  $apk = Get-ChildItem (Join-Path $root 'android\app\build\outputs\apk\release') -Filter '*.apk' -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $apk) { Fail 'No release APK found under android\app\build\outputs\apk\release' }
  Step "Installing $($apk.Name)"
  & adb install -r $apk.FullName
  if ($LASTEXITCODE -ne 0) { Fail 'adb install' }
}

# ---- 5. launch and look ----
Step 'Launching the app'
& adb logcat -c
& adb shell monkey -p $pkg -c android.intent.category.LAUNCHER 1 | Out-Null
Start-Sleep -Seconds 6
function Shot($name) {
  & adb shell screencap -p /sdcard/hum-shot.png
  & adb pull /sdcard/hum-shot.png (Join-Path $out "screenshot-$name.png") | Out-Null
  & adb shell rm /sdcard/hum-shot.png
}
Shot 'start'

# ---- 6. measure while you play ----
Step "Measuring for $Seconds seconds. PLAY NOW: put 5 singers on the stage and keep them moving."
& adb shell dumpsys gfxinfo $pkg reset | Out-Null
Start-Sleep -Seconds $Seconds
& adb shell dumpsys gfxinfo $pkg | Out-File -Encoding utf8 (Join-Path $out 'gfxinfo.txt')
Shot 'after'
& adb logcat -d -v time ReactNativeJS:V ReactNative:V AndroidRuntime:E DEBUG:E '*:S' | Out-File -Encoding utf8 (Join-Path $out 'logcat.txt')

# ---- 7. summary ----
Step 'Summary'
$g = Get-Content (Join-Path $out 'gfxinfo.txt') -Raw
$pick = { param($re) if ($g -match $re) { $Matches[0] } else { "(not found: $re)" } }
$lines = @(
  "commit: $commit",
  (& $pick 'Total frames rendered: \d+'),
  (& $pick 'Janky frames: \d+ \([\d.]+%\)'),
  (& $pick '50th percentile: \d+ms'),
  (& $pick '90th percentile: \d+ms'),
  (& $pick '95th percentile: \d+ms'),
  (& $pick '99th percentile: \d+ms')
)
$errs = (Select-String -Path (Join-Path $out 'logcat.txt') -Pattern 'ReactNativeJS.*(Error|undefined is not)|FATAL EXCEPTION' -ErrorAction SilentlyContinue | Measure-Object).Count
$lines += "JS/native errors in logcat: $errs"
$lines += 'Note: gfxinfo counts Android UI frames; Skia drawing may not appear there. Judge by feel and the screenshots too.'
$lines | Tee-Object -FilePath (Join-Path $out 'summary.txt')
Write-Host "`nAll files: $out" -ForegroundColor Green
