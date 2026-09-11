# collect_pc_inventory.ps1 — PC 側の棚卸し用 収集スクリプト(読み取り専用)
#
# 何をするか: ~/.claude、AI_WORKSPACE、ui-workbench、tools/jan、scratchpad、git リポジトリ、
#             ツールのバージョンを一覧にし、メモリ系 Markdown の写しを 1 フォルダにまとめる。
# 書き込み先: %USERPROFILE%\Desktop\pc_inventory_<yyyyMMdd>\ のみ。それ以外には一切書かない。
# 読まないもの: .env / *key* / credentials* / *.pem / *token* / *secret*(名前で除外)。
#               settings.json は hooks / permissions / mcpServers のキー名だけ書き出し、値は写さない。
# 写しの中に API キーらしき文字列があれば伏字にする。
#
# 使い方: powershell -ExecutionPolicy Bypass -File handoff\collect_pc_inventory.ps1

$ErrorActionPreference = 'Continue'
$stamp  = Get-Date -Format 'yyyyMMdd'
$home_  = $env:USERPROFILE
$out    = Join-Path $home_ ("Desktop\pc_inventory_" + $stamp)
New-Item -ItemType Directory -Force -Path $out | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $out '11_memory') | Out-Null

$summary = New-Object System.Collections.Generic.List[string]
function Note($s) { $script:summary.Add($s); Write-Host $s }

# --- 除外(名前で判定。中身は開かない) ---
$denyName = '(^\.env|\.env$|key|credential|\.pem$|token|secret|password)'
function IsDenied($path) { return ([IO.Path]::GetFileName($path) -imatch $denyName) }

# --- 伏字化(写しを取る Markdown にだけ適用) ---
function Redact($text) {
  $t = $text
  $t = [regex]::Replace($t, 'sk-ant-[A-Za-z0-9_\-]{8,}', 'sk-ant-[REDACTED]')
  $t = [regex]::Replace($t, '(?i)(api[_\- ]?key|access[_\- ]?key|secret|token|password)\s*[:=]\s*\S+', '$1: [REDACTED]')
  $t = [regex]::Replace($t, 'AKIA[0-9A-Z]{16}', '[REDACTED-AWS]')
  $t = [regex]::Replace($t, 'ghp_[A-Za-z0-9]{20,}', '[REDACTED-GH]')
  return $t
}

function Tree($root, $file) {
  if (-not (Test-Path $root)) { Note ("NOT_FOUND  " + $root); return }
  Note ("FOUND      " + $root)
  Get-ChildItem -Path $root -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\\node_modules\\' } |
    Select-Object @{n='size';e={$_.Length}}, @{n='modified';e={$_.LastWriteTime.ToString('yyyy-MM-dd HH:mm')}}, FullName |
    Sort-Object FullName |
    Format-Table -AutoSize -Wrap | Out-String -Width 400 | Set-Content -Encoding UTF8 (Join-Path $out $file)
}

function CopyMd($src, $destName) {
  if (-not (Test-Path $src)) { return }
  if (IsDenied $src) { Note ("SKIPPED(denied name) " + $src); return }
  $raw = Get-Content -Raw -Encoding UTF8 $src
  $dest = Join-Path (Join-Path $out '11_memory') $destName
  ("<!-- copied from: " + $src + " -->`n" + (Redact $raw)) | Set-Content -Encoding UTF8 $dest
  Note ("COPIED     " + $src)
}

# ===== 1. ~/.claude =====
$claude = Join-Path $home_ '.claude'
Tree $claude '10_claude_tree.txt'

if (Test-Path $claude) {
  CopyMd (Join-Path $claude 'CLAUDE.md') 'global_CLAUDE.md'
  # プロジェクト別メモリ
  Get-ChildItem -Path (Join-Path $claude 'projects') -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $proj = $_.Name
    Get-ChildItem -Path (Join-Path $_.FullName 'memory') -Filter *.md -File -ErrorAction SilentlyContinue | ForEach-Object {
      CopyMd $_.FullName ("memory__" + $proj + "__" + $_.Name)
    }
  }
  # playbooks
  Get-ChildItem -Path (Join-Path $claude 'playbooks') -Filter *.md -File -ErrorAction SilentlyContinue | ForEach-Object {
    CopyMd $_.FullName ("playbook__" + $_.Name)
  }
  # skills
  Get-ChildItem -Path (Join-Path $claude 'skills') -Recurse -Filter SKILL.md -File -ErrorAction SilentlyContinue | ForEach-Object {
    $skill = $_.Directory.Name
    CopyMd $_.FullName ("skill__" + $skill + ".md")
  }
  # settings: キー名だけ
  $lines = New-Object System.Collections.Generic.List[string]
  foreach ($sf in @('settings.json', 'settings.local.json')) {
    $p = Join-Path $claude $sf
    if (-not (Test-Path $p)) { $lines.Add("NOT_FOUND " + $sf); continue }
    try {
      $j = Get-Content -Raw -Encoding UTF8 $p | ConvertFrom-Json
      $lines.Add("== " + $sf + " ==")
      $lines.Add("top-level keys: " + (($j.PSObject.Properties.Name) -join ', '))
      if ($j.hooks) { $lines.Add("hooks events: " + (($j.hooks.PSObject.Properties.Name) -join ', ')) }
      if ($j.permissions) {
        if ($j.permissions.allow) { $lines.Add("permissions.allow (" + $j.permissions.allow.Count + "): " + ($j.permissions.allow -join ' | ')) }
        if ($j.permissions.deny)  { $lines.Add("permissions.deny  (" + $j.permissions.deny.Count  + "): " + ($j.permissions.deny  -join ' | ')) }
      }
      if ($j.mcpServers) { $lines.Add("mcpServers: " + (($j.mcpServers.PSObject.Properties.Name) -join ', ')) }
      if ($j.model) { $lines.Add("model: " + $j.model) }
    } catch { $lines.Add("PARSE_ERROR " + $sf + ": " + $_.Exception.Message) }
  }
  $lines | Set-Content -Encoding UTF8 (Join-Path $out '12_settings_keys.txt')
}

# ===== 2. 作業領域 =====
$wsLines = New-Object System.Collections.Generic.List[string]
$candidates = @(
  (Join-Path $home_ 'AI_WORKSPACE'),
  (Join-Path $home_ 'ui-workbench'),
  (Join-Path $home_ 'tools\jan'),
  (Join-Path $env:LOCALAPPDATA 'Temp\claude'),
  (Join-Path $env:LOCALAPPDATA 'Temp\hbk')
)
# リポジトリ配下の AI_WORKSPACE / ui-workbench も探す(このスクリプトの2つ上=リポジトリ直下)
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$candidates += (Join-Path $repoRoot 'AI_WORKSPACE')
$candidates += (Join-Path $repoRoot 'ui-workbench')
# ホーム直下・Documents・Desktop・source にある AI_WORKSPACE も
foreach ($base in @($home_, (Join-Path $home_ 'Documents'), (Join-Path $home_ 'Desktop'), (Join-Path $home_ 'source'))) {
  Get-ChildItem -Path $base -Directory -Depth 2 -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -in @('AI_WORKSPACE','ui-workbench') } | ForEach-Object { $candidates += $_.FullName }
}
$candidates = $candidates | Sort-Object -Unique
foreach ($c in $candidates) {
  if (-not (Test-Path $c)) { $wsLines.Add("NOT_FOUND " + $c); Note ("NOT_FOUND  " + $c); continue }
  Note ("FOUND      " + $c)
  $wsLines.Add("")
  $wsLines.Add("== " + $c + " ==")
  Get-ChildItem -Path $c -Recurse -ErrorAction SilentlyContinue -Depth 3 |
    Where-Object { $_.FullName -notmatch '\\node_modules\\' } |
    ForEach-Object {
      $kind = if ($_.PSIsContainer) { 'DIR ' } else { 'FILE' }
      $size = if ($_.PSIsContainer) { '' } else { $_.Length }
      $wsLines.Add(("{0} {1,12} {2} {3}" -f $kind, $size, $_.LastWriteTime.ToString('yyyy-MM-dd'), $_.FullName))
    }
}
$wsLines | Set-Content -Encoding UTF8 (Join-Path $out '20_workspace_tree.txt')

# ===== 3. git リポジトリ =====
$gitLines = New-Object System.Collections.Generic.List[string]
$roots = @($home_, (Join-Path $home_ 'Documents'), (Join-Path $home_ 'Desktop'), (Join-Path $home_ 'source'), (Join-Path $home_ 'repos'), (Join-Path $home_ 'projects'), (Join-Path $home_ 'dev'))
$seen = @{}
foreach ($r in $roots) {
  if (-not (Test-Path $r)) { continue }
  Get-ChildItem -Path $r -Directory -Recurse -Depth 3 -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -eq '.git' -and $_.FullName -notmatch '\\node_modules\\' } | ForEach-Object {
      $repo = $_.Parent.FullName
      if ($seen.ContainsKey($repo)) { return }
      $seen[$repo] = $true
      Push-Location $repo
      $last   = (git log -1 --format='%ad %s' --date=short 2>$null)
      $branch = (git rev-parse --abbrev-ref HEAD 2>$null)
      $remote = (git remote get-url origin 2>$null)
      $count  = (git rev-list --count HEAD 2>$null)
      $all    = (git branch -a --format='%(refname:short)' 2>$null) -join ', '
      Pop-Location
      $gitLines.Add("")
      $gitLines.Add("== " + $repo + " ==")
      $gitLines.Add("remote : " + $remote)
      $gitLines.Add("branch : " + $branch + "  (commits: " + $count + ")")
      $gitLines.Add("last   : " + $last)
      $gitLines.Add("refs   : " + $all)
      Note ("GIT        " + $repo + "  [" + $branch + "] " + $last)
    }
}
if ($gitLines.Count -eq 0) { $gitLines.Add("NOT_FOUND (no .git under " + ($roots -join ', ') + ")") }
$gitLines | Set-Content -Encoding UTF8 (Join-Path $out '30_git_repos.txt')

# ===== 4. 環境 =====
$env_ = New-Object System.Collections.Generic.List[string]
foreach ($cmd in @('node --version','npm --version','python --version','git --version','claude --version','codex --version')) {
  try { $v = (Invoke-Expression $cmd 2>&1 | Out-String).Trim(); $env_.Add($cmd + " -> " + $v) }
  catch { $env_.Add($cmd + " -> NOT_FOUND") }
}
$env_.Add("OS -> " + (Get-CimInstance Win32_OperatingSystem).Caption)
$env_ | Set-Content -Encoding UTF8 (Join-Path $out '40_env.txt')

# ===== 5. サマリ =====
$summary.Insert(0, "pc_inventory " + (Get-Date -Format 'yyyy-MM-dd HH:mm') + "  output: " + $out)
$summary.Insert(1, "読んでいないもの: .env / *key* / credential* / *.pem / *token* / *secret* / *password*(名前で除外)")
$summary.Insert(2, "")
$summary | Set-Content -Encoding UTF8 (Join-Path $out '00_SUMMARY.txt')
Write-Host ""
Write-Host ("完了。出力: " + $out)
Write-Host "次: handoff\PROMPT_FOR_LOCAL_CLAUDE.md の本文を Claude Code に貼る"
