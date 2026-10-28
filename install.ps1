# Installa la skill «nox-api-approval» per Claude Code su Windows: ogni chiamata API deve passare da Nox.
#   powershell -ExecutionPolicy Bypass -File install.ps1                      skill + hook + regola globale + aggiornamento automatico
#   powershell -ExecutionPolicy Bypass -File install.ps1 -SoloSkill           solo la skill
#   powershell -ExecutionPolicy Bypass -File install.ps1 -SenzaAggiornamento  senza l'aggiornamento automatico all'avvio di ogni chat
# Da zero: scarica questo file dalla repo (vedi il README) e lancialo come sopra.
# Si può rilanciare quando vuoi. Serve Python 3 (per gli hook). Prima di toccare settings.json e CLAUDE.md ne salva una copia .bak-nox.
param([switch]$SoloSkill, [switch]$SenzaAggiornamento)
$ErrorActionPreference = "Stop"
$Base = if ($env:NOX_SKILL_BASE) { $env:NOX_SKILL_BASE } else { "https://raw.githubusercontent.com/MorettoAlessandro/nox-skill/main" }
$Src = if ($PSScriptRoot) { $PSScriptRoot } else { "" }
function Get-Repo($Path, $Dest) {
  $local = if ($Src) { Join-Path $Src $Path } else { "" }
  if ($local -and (Test-Path $local)) { Copy-Item -Force $local $Dest }
  else { Invoke-WebRequest -UseBasicParsing -Uri "$Base/$Path" -OutFile $Dest }
}
$ClaudeDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME ".claude" }
$SkillDir = Join-Path $ClaudeDir "skills\nox-api-approval"
$HooksDir = Join-Path $ClaudeDir "hooks"
New-Item -ItemType Directory -Force -Path $SkillDir, $HooksDir | Out-Null

Write-Host "Installo la skill in $SkillDir"
Get-Repo "SKILL.md" (Join-Path $SkillDir "SKILL.md")
Get-Repo "claude-md.md" (Join-Path $SkillDir "claude-md.md")
$Hook = Join-Path $HooksDir "nox-block-direct-api.py"
$UpdateHook = Join-Path $HooksDir "nox-update-skill.py"
Get-Repo "hooks/nox-block-direct-api.py" $Hook
Get-Repo "hooks/nox-update-skill.py" $UpdateHook

if ($SoloSkill) { Write-Host "Fatto (solo skill). Apri una nuova chat di Claude Code per caricarla."; exit 0 }

$Py = $null
foreach ($c in @("python", "python3")) {
  try { & $c --version *> $null; if ($LASTEXITCODE -eq 0) { $Py = $c; break } } catch { }
}
if (-not $Py) { Write-Error "Serve Python 3 per gli hook e per aggiornare le impostazioni."; exit 1 }

Write-Host "Registro gli hook in $ClaudeDir\settings.json e la regola in $ClaudeDir\CLAUDE.md"
$Settings = Join-Path ([System.IO.Path]::GetTempPath()) ("nox-settings-" + [guid]::NewGuid().ToString("N") + ".py")
Get-Repo "hooks/nox-install-settings.py" $Settings
$Auto = if ($SenzaAggiornamento) { "0" } else { "1" }
try { & $Py $Settings $ClaudeDir $Hook (Join-Path $SkillDir "claude-md.md") $UpdateHook $Auto $Base $Py } finally { Remove-Item $Settings -ErrorAction SilentlyContinue }
if ($LASTEXITCODE -ne 0) { Write-Error "Non sono riuscito ad aggiornare le impostazioni."; exit 1 }

if ($Auto -eq "1") { Write-Host "Aggiornamento automatico attivo: all'avvio di ogni chat la skill si allinea a $Base." }
Write-Host "Fatto. Le chat già aperte non cambiano: apri una nuova chat di Claude Code."
Write-Host "Ogni chat dovrà farsi approvare in Nox (scheda Modifiche) prima di usare le API."
