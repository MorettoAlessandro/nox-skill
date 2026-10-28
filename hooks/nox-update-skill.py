#!/usr/bin/env python3
"""SessionStart: tiene aggiornata la skill nox-api-approval scaricandola da GitHub (repo nox-skill) quando cambia.
Non scrive mai nulla se la rete non risponde o se il testo non è quello atteso; non blocca mai l'avvio della chat."""
import json, os, re, sys, tempfile, urllib.parse, urllib.request

CLAUDE = os.environ.get("CLAUDE_CONFIG_DIR") or os.path.join(os.path.expanduser("~"), ".claude")
START, END = "<!-- nox-api-approval:start -->", "<!-- nox-api-approval:end -->"
MAX = 60000
DEFAULT_BASE = "https://raw.githubusercontent.com/MorettoAlessandro/nox-skill/main"

def fetch(url):
    # Cloudflare rifiuta lo user agent predefinito di Python (errore 1010): il hook si presenta con il suo nome
    req = urllib.request.Request(url, headers={"User-Agent": "nox-skill-updater/1.0"})
    with urllib.request.urlopen(req, timeout=5) as r:
        final = urllib.parse.urlparse(r.geturl())
        if final.scheme != "https" and (final.hostname or "") not in ("localhost", "127.0.0.1", "::1"):
            raise ValueError("reindirizzamento verso un indirizzo non sicuro")
        data = r.read(MAX + 1)
    if len(data) > MAX:
        raise ValueError("risposta troppo grande")
    return data.decode("utf-8")

def write_if_changed(path, text):
    try:
        if open(path, encoding="utf-8").read() == text:
            return False
    except FileNotFoundError:
        pass
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path))
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(text)
    os.replace(tmp, path)
    return True

def main():
    try:
        cfg = json.load(open(os.path.join(CLAUDE, "nox-skill.json"), encoding="utf-8"))
    except FileNotFoundError:
        cfg = {}
    # «base» = cartella da cui scaricare; le installazioni vecchie hanno «server» (il server Nox, che ora rimanda a GitHub)
    base = str(cfg.get("base") or "").rstrip("/")
    if not base and cfg.get("server"):
        base = str(cfg["server"]).rstrip("/") + "/skill/nox-api-approval"
    base = base or DEFAULT_BASE
    u = urllib.parse.urlparse(base)
    local = (u.hostname or "") in ("localhost", "127.0.0.1", "::1")
    if u.scheme not in ("https", "http") or not u.hostname or (u.scheme == "http" and not local):
        return 0  # solo https (o http in locale): mai un indirizzo in chiaro su rete
    base += "/"
    skill, rule = fetch(base + "SKILL.md"), fetch(base + "claude-md.md").strip()
    if not skill.startswith("---\nname: nox-api-approval\n") or "request_access" not in skill:
        return 0
    if "propose_write" not in rule or START in rule or END in rule:
        return 0
    skill_dir = os.path.join(CLAUDE, "skills", "nox-api-approval")
    os.makedirs(skill_dir, exist_ok=True)
    write_if_changed(os.path.join(skill_dir, "SKILL.md"), skill)
    md_path = os.path.join(CLAUDE, "CLAUDE.md")
    try:
        md = open(md_path, encoding="utf-8").read()
    except FileNotFoundError:
        md = ""
    block = START + "\n" + rule + "\n" + END + "\n"
    a, b = md.find(START), md.find(END)
    if a != -1 and b > a:
        md = md[:a] + block + md[b + len(END):].lstrip("\n")
    else:
        md = (md.rstrip("\n") + "\n\n" if md.strip() else "") + block
    write_if_changed(md_path, md)
    return 0

try:
    main()
except Exception:
    pass
sys.exit(0)
