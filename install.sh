#!/usr/bin/env bash
# Installa la skill «nox-api-approval» per Claude Code: ogni chiamata API deve passare da Nox.
#   bash install.sh                         skill + hook che blocca curl/wget esterni + regola globale in CLAUDE.md + aggiornamento automatico
#   bash install.sh --solo-skill            solo la skill (nessuna modifica a settings.json e CLAUDE.md)
#   bash install.sh --senza-aggiornamento   come la prima, ma senza l'aggiornamento automatico all'avvio di ogni chat
# Da zero (scarica lo script ed eseguilo): vedi il README.
# Si può rilanciare quando vuoi: aggiorna senza duplicare. Prima di toccare settings.json e CLAUDE.md ne salva una copia .bak-nox.
set -euo pipefail

SOLO_SKILL=0
AUTO_UPDATE=1
for arg in "$@"; do
  case "$arg" in
    --solo-skill) SOLO_SKILL=1 ;;
    --senza-aggiornamento) AUTO_UPDATE=0 ;;
    *) echo "Uso: bash install.sh [--solo-skill] [--senza-aggiornamento]" >&2; exit 2 ;;
  esac
done

BASE="${NOX_SKILL_BASE:-https://raw.githubusercontent.com/MorettoAlessandro/nox-skill/main}"
# lanciato da una copia della repo usa i file accanto allo script; lanciato via pipe li scarica da GitHub
SRC=""
if [ -f "${BASH_SOURCE[0]:-}" ]; then SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; fi
get() { # $1 = percorso nella repo, $2 = destinazione
  if [ -n "$SRC" ] && [ -f "$SRC/$1" ]; then cp "$SRC/$1" "$2"; else curl -fsSL "$BASE/$1" -o "$2"; fi
}

CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
SKILL_DIR="$CLAUDE_DIR/skills/nox-api-approval"
HOOK="$CLAUDE_DIR/hooks/nox-block-direct-api.py"
UPDATE_HOOK="$CLAUDE_DIR/hooks/nox-update-skill.py"
mkdir -p "$SKILL_DIR" "$CLAUDE_DIR/hooks"

echo "Installo la skill in $SKILL_DIR"
get SKILL.md "$SKILL_DIR/SKILL.md"
get claude-md.md "$SKILL_DIR/claude-md.md"
get hooks/nox-block-direct-api.py "$HOOK"
get hooks/nox-update-skill.py "$UPDATE_HOOK"

if [ "$SOLO_SKILL" = 1 ]; then
  echo
  echo "Fatto (solo skill). Apri una nuova chat di Claude Code per caricarla."
  exit 0
fi

command -v python3 >/dev/null || { echo "Serve python3 per l'hook e per aggiornare le impostazioni." >&2; exit 1; }
chmod +x "$HOOK" "$UPDATE_HOOK"

SETTINGS_PY="$(mktemp "${TMPDIR:-/tmp}/nox-settings.XXXXXX")"
trap 'rm -f "$SETTINGS_PY"' EXIT
get hooks/nox-install-settings.py "$SETTINGS_PY"

echo "Registro l'hook in $CLAUDE_DIR/settings.json e la regola in $CLAUDE_DIR/CLAUDE.md"
python3 "$SETTINGS_PY" "$CLAUDE_DIR" "$HOOK" "$SKILL_DIR/claude-md.md" "$UPDATE_HOOK" "$AUTO_UPDATE" "$BASE" python3

echo
if [ "$AUTO_UPDATE" = 1 ]; then echo "Aggiornamento automatico attivo: all'avvio di ogni chat la skill si allinea a $BASE."; fi
echo "Fatto. Le chat già aperte non cambiano: apri una nuova chat di Claude Code."
echo "Ogni chat dovrà farsi approvare in Nox (scheda Approvazioni) prima di usare le API."
