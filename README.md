# nox-skill

Skill per Claude Code che insegna a ogni chat che **le chiamate API passano da [Nox](https://github.com/MorettoAlessandro/nox)**: la chat chiede l'accesso (`request_access`), tu lo approvi nell'app Nox, le letture passano da `read` e ogni modifica è una proposta (`propose_write`) che approvi tu.

Contiene solo istruzioni e un filtro: nessun segreto.

## Installare

macOS / Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/MorettoAlessandro/nox-skill/main/install.sh -o install.sh && bash install.sh
```

Windows (serve Python 3):

```powershell
irm https://raw.githubusercontent.com/MorettoAlessandro/nox-skill/main/install.ps1 -OutFile install.ps1; powershell -ExecutionPolicy Bypass -File install.ps1
```

L'installer mette sul computer:
- la skill in `~/.claude/skills/nox-api-approval/`;
- un hook che blocca `curl`/`wget` verso host non locali;
- la regola globale in `~/.claude/CLAUDE.md` (prima salva una copia `.bak-nox`);
- un hook `SessionStart` per l'aggiornamento automatico.

Si può rilanciare quando vuoi senza duplicati. Opzioni: `--solo-skill` (solo la skill) e `--senza-aggiornamento` (`-SoloSkill` e `-SenzaAggiornamento` su Windows).

## Aggiornamento automatico

All'avvio di ogni chat l'hook scarica `SKILL.md` e `claude-md.md` da questa repo (ramo `main`) e, se sono cambiati, aggiorna la skill e il blocco in `~/.claude/CLAUDE.md`. Per aggiornare tutti i computer basta fare push su `main`. L'hook:
- usa solo https (http solo verso localhost), con il controllo del certificato;
- non scrive e non stampa nulla se la rete non risponde, se il testo scaricato non è quello atteso o se supera 60 KB;
- vale dalla chat successiva (le chat già aperte non cambiano).

Claude Desktop, Cowork e claude.ai non usano questi file: lì la skill si ricarica a mano.

## Contenuto

| File | Cosa fa |
|---|---|
| `SKILL.md` | La skill vera e propria |
| `claude-md.md` | Il blocco di regole che finisce in `~/.claude/CLAUDE.md` |
| `hooks/nox-block-direct-api.py` | Blocca le chiamate API dirette |
| `hooks/nox-update-skill.py` | Aggiornamento automatico all'avvio |
| `hooks/nox-install-settings.py` | Registra gli hook in `settings.json` e la regola in `CLAUDE.md` |
| `install.sh`, `install.ps1` | Installer |

## Test

```bash
npm test
```
