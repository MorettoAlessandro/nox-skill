#!/usr/bin/env python3
"""PreToolUse (Bash): blocca le chiamate API dirette; devono passare da Nox (skill nox-api-approval)."""
import json, re, sys

# il comando conta solo in posizione di comando (inizio, dopo ; & | ( ` virgolette, o dopo then/do/xargs/sudo/env/exec)
POS = r"(?:^|[;&|(`'\"]|\b(?:then|do|else|xargs|sudo|env|exec|command|time|nohup)\s)\s*"
CLIENT = re.compile(POS + r"(?:curl|wget|xh|httpie|Invoke-RestMethod|Invoke-WebRequest|irm|iwr)(?=\s|$)|" + POS + r"gh\s+api(?=\s|$)", re.I)
URL = re.compile(r"https?://([^/\s'\"?#:]+|\[[^\]]+\])", re.I)
LOCAL = re.compile(r"^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\]|[\w.-]+\.localhost)$", re.I)

def main():
    try:
        cmd = (json.load(sys.stdin).get("tool_input") or {}).get("command", "")
    except Exception:
        return 0
    if not CLIENT.search(cmd):
        return 0
    hosts = [m.group(1) for m in URL.finditer(cmd)]
    if hosts and all(LOCAL.match(h) for h in hosts):
        return 0
    json.dump({"hookSpecificOutput": {
        "hookEventName": "PreToolUse", "permissionDecision": "deny",
        "permissionDecisionReason": "Chiamata diretta bloccata: ogni chiamata API deve passare da Nox. Usa gli strumenti MCP di Nox (request_access, poi read / propose_write) come descritto nella skill nox-api-approval; se Nox non e' raggiungibile, dillo all'utente."}}, sys.stdout)
    return 0

sys.exit(main())
