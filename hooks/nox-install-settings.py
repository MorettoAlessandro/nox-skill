#!/usr/bin/env python3
"""Registra gli hook di Nox in settings.json e la regola in CLAUDE.md (usato da install.sh e install.ps1)."""
import json, os, shutil, sys
claude, hook, rule_file, update_hook, auto_update, base = sys.argv[1:7]
py = sys.argv[7] if len(sys.argv) > 7 else "python3"

# settings.json: un solo hook PreToolUse sul Bash, senza duplicati
path = os.path.join(claude, "settings.json")
try:
    settings = json.load(open(path, encoding="utf-8"))
except FileNotFoundError:
    settings = {}
else:
    shutil.copy(path, path + ".bak-nox")
entries = settings.setdefault("hooks", {}).setdefault("PreToolUse", [])
entries[:] = [e for e in entries if not any("nox-block-direct-api" in h.get("command", "") for h in e.get("hooks", []))]
entries.append({"matcher": "Bash", "hooks": [{"type": "command", "command": '%s "%s"' % (py, hook)}]})
# aggiornamento automatico: all'avvio di ogni chat riscarica la skill da GitHub se è cambiata
start = settings["hooks"].setdefault("SessionStart", [])
start[:] = [e for e in start if not any("nox-update-skill" in h.get("command", "") for h in e.get("hooks", []))]
if auto_update == "1" and base:
    start.append({"hooks": [{"type": "command", "command": '%s "%s"' % (py, update_hook)}]})
    json.dump({"base": base}, open(os.path.join(claude, "nox-skill.json"), "w", encoding="utf-8"))
tmp = path + ".tmp"
json.dump(settings, open(tmp, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
os.replace(tmp, path)

# CLAUDE.md: il blocco tra i marcatori viene sostituito, altrimenti aggiunto in fondo
START, END = "<!-- nox-api-approval:start -->", "<!-- nox-api-approval:end -->"
block = START + "\n" + open(rule_file, encoding="utf-8").read().strip() + "\n" + END + "\n"
md_path = os.path.join(claude, "CLAUDE.md")
try:
    md = open(md_path, encoding="utf-8").read()
    shutil.copy(md_path, md_path + ".bak-nox")
except FileNotFoundError:
    md = ""
a, b = md.find(START), md.find(END)
if a != -1 and b > a:
    md = md[:a] + block + md[b + len(END):].lstrip("\n")
else:
    md = (md.rstrip("\n") + "\n\n" if md.strip() else "") + block
open(md_path, "w", encoding="utf-8").write(md)
