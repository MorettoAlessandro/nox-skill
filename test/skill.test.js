const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { execFile, execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(ROOT, name), "utf8");
const tmp = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

test("l'installer: installa skill, hook e regola; si può rilanciare senza duplicati", () => {
  const home = tmp("nox-home-");
  const claude = path.join(home, ".claude");
  fs.mkdirSync(claude);
  fs.writeFileSync(path.join(claude, "settings.json"), JSON.stringify({ theme: "x", hooks: { PreToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: "altro" }] }] } }));
  fs.writeFileSync(path.join(claude, "CLAUDE.md"), "# Mie regole\n\nUna riga.\n");
  const env = { ...process.env, HOME: home };
  delete env.CLAUDE_CONFIG_DIR;
  const run = (...args) => execFileSync("bash", [path.join(ROOT, "install.sh"), ...args], { env, encoding: "utf8" });
  run(); run();
  assert.ok(fs.existsSync(path.join(claude, "skills/nox-api-approval/SKILL.md")));
  const hook = path.join(claude, "hooks/nox-block-direct-api.py");
  assert.ok(fs.statSync(hook).mode & 0o100, "hook eseguibile");
  const settings = JSON.parse(fs.readFileSync(path.join(claude, "settings.json"), "utf8"));
  assert.equal(settings.theme, "x", "le altre impostazioni restano");
  assert.equal(settings.hooks.PreToolUse.length, 2, "un solo hook Nox anche dopo due installazioni");
  assert.ok(settings.hooks.PreToolUse.some((e) => e.hooks[0].command === "altro"));
  const md = fs.readFileSync(path.join(claude, "CLAUDE.md"), "utf8");
  assert.ok(md.startsWith("# Mie regole"));
  assert.equal(md.split("nox-api-approval:start").length, 2, "regola presente una volta sola");
  assert.equal(settings.hooks.SessionStart.length, 1, "un solo aggiornamento automatico anche dopo due installazioni");
  assert.match(settings.hooks.SessionStart[0].hooks[0].command, /nox-update-skill\.py/);
  assert.match(JSON.parse(fs.readFileSync(path.join(claude, "nox-skill.json"), "utf8")).base, /^https:\/\/raw\.githubusercontent\.com\/MorettoAlessandro\/nox-skill\/main$/);
  run("--senza-aggiornamento");
  const senza = JSON.parse(fs.readFileSync(path.join(claude, "settings.json"), "utf8"));
  assert.equal((senza.hooks.SessionStart || []).length, 0, "senza aggiornamento l'hook viene tolto");
  assert.equal(senza.hooks.PreToolUse.length, 2, "il blocco delle chiamate dirette resta");
  assert.ok(fs.existsSync(path.join(claude, "settings.json.bak-nox")) && fs.existsSync(path.join(claude, "CLAUDE.md.bak-nox")));
  // l'hook installato blocca davvero
  const out = (cmd) => execFileSync("python3", [hook], { input: JSON.stringify({ tool_input: { command: cmd } }), encoding: "utf8" });
  assert.match(out("cur" + "l https://api.example.com/x"), /deny/);
  assert.equal(out("cur" + "l http://localhost:4818/api/state"), "");
  // solo skill: nessuna modifica alle impostazioni
  const home2 = tmp("nox-home-");
  execFileSync("bash", [path.join(ROOT, "install.sh"), "--solo-skill"], { env: { ...env, HOME: home2 } });
  assert.ok(fs.existsSync(path.join(home2, ".claude/skills/nox-api-approval/SKILL.md")));
  assert.ok(!fs.existsSync(path.join(home2, ".claude/settings.json")));
});

test("la skill conserva le regole essenziali (se qualcuno le cancella per sbaglio il test lo segnala)", () => {
  const text = read("SKILL.md");
  assert.match(text, /^---\nname: nox-api-approval\n/);
  for (const frase of ["request_access", "check_access", "propose_write", "list_proposals", "chatId", "Esplora / Esegui", "Vietato", "wait_for_approval"]) {
    assert.ok(text.includes(frase), `manca «${frase}»`);
  }
  assert.match(text, /curl/);
  assert.ok(!/App\/credenziali|hrx|jumpserver/i.test(text), "la skill deve restare generica, senza nomi personali");
  assert.ok(text.split("\n").length < 100, "la skill deve restare corta");
});

// ---------- aggiornamento automatico (hook SessionStart) ----------
async function withSkillServer(files, fn) {
  const srv = http.createServer((req, res) => {
    const name = req.url.split("/").pop();
    if (files[name] === undefined) { res.statusCode = 404; return res.end("no"); }
    res.setHeader("Content-Type", "text/markdown"); res.end(files[name]);
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  try { return await fn(`http://127.0.0.1:${srv.address().port}`); } finally { srv.close(); }
}
function hookEnv(config) {
  const claude = tmp("nox-upd-");
  fs.writeFileSync(path.join(claude, "nox-skill.json"), JSON.stringify(config));
  const hook = path.join(ROOT, "hooks/nox-update-skill.py");
  // il hook gira in un processo a parte: execFileSync bloccherebbe il server di prova nello stesso processo
  const run = () => new Promise((resolve, reject) => execFile("python3", [hook], { env: { ...process.env, CLAUDE_CONFIG_DIR: claude }, encoding: "utf8" }, (e, o) => (e ? reject(e) : resolve(o))));
  return { claude, run, skill: path.join(claude, "skills/nox-api-approval/SKILL.md"), md: path.join(claude, "CLAUDE.md") };
}

test("l'hook di avvio scarica la skill nuova, aggiorna il blocco in CLAUDE.md e non riscrive se non cambia", async () => {
  const newer = read("SKILL.md").replace("Regola di sicurezza.", "Regola di sicurezza AGGIORNATA.");
  await withSkillServer({ "SKILL.md": newer, "claude-md.md": read("claude-md.md") }, async (base) => {
    const t = hookEnv({ base });
    fs.writeFileSync(t.md, "# Mie regole\n");
    assert.equal(await t.run(), "", "non scrive nulla nella chat");
    assert.equal(fs.readFileSync(t.skill, "utf8"), newer);
    const md = fs.readFileSync(t.md, "utf8");
    assert.ok(md.startsWith("# Mie regole") && md.includes("prepare_in_explore"));
    const before = fs.statSync(t.skill).mtimeMs;
    await new Promise((r) => setTimeout(r, 20));
    await t.run();
    assert.equal(fs.statSync(t.skill).mtimeMs, before, "invariata: non riscritta");
    assert.equal(fs.readFileSync(t.md, "utf8").split("nox-api-approval:start").length, 2, "blocco una volta sola");
  });
});

test("le installazioni vecchie (config con «server») continuano ad aggiornarsi dal percorso /skill/nox-api-approval/", async () => {
  const files = { "SKILL.md": read("SKILL.md"), "claude-md.md": read("claude-md.md") };
  const seen = [];
  const srv = http.createServer((req, res) => { seen.push(req.url); res.end(files[req.url.split("/").pop()] ?? ""); });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  try {
    const t = hookEnv({ server: `http://127.0.0.1:${srv.address().port}` });
    await t.run();
    assert.deepEqual(seen, ["/skill/nox-api-approval/SKILL.md", "/skill/nox-api-approval/claude-md.md"]);
    assert.ok(fs.existsSync(t.skill));
  } finally { srv.close(); }
});

test("l'hook di avvio non tocca nulla se il testo non è quello atteso, se la rete non risponde o se non è https", async () => {
  await withSkillServer({ "SKILL.md": "qualcosa di strano", "claude-md.md": "altro" }, async (base) => {
    const t = hookEnv({ base });
    assert.equal(await t.run(), "");
    assert.ok(!fs.existsSync(t.skill) && !fs.existsSync(t.md), "testo non valido: niente scritto");
  });
  const down = hookEnv({ base: "http://127.0.0.1:1" });
  assert.equal(await down.run(), "", "server spento: silenzio e nessun errore");
  assert.ok(!fs.existsSync(down.skill));
  const plain = hookEnv({ base: "http://example.com" }); // http verso un host non locale: rifiutato senza nemmeno provare
  assert.equal(await plain.run(), "");
  assert.ok(!fs.existsSync(plain.skill));
});

test("install.ps1: scrive gli stessi file dell'installer per macOS/Linux e usa percorsi Windows", () => {
  const ps = read("install.ps1");
  for (const f of ["SKILL.md", "claude-md.md", "hooks/nox-block-direct-api.py", "hooks/nox-update-skill.py", "hooks/nox-install-settings.py"]) {
    assert.ok(ps.includes(f), `install.ps1 non scarica ${f}`);
    assert.ok(read("install.sh").includes(f), `install.sh non scarica ${f}`);
  }
  assert.match(ps, /skills\\nox-api-approval/);
  assert.equal(read("install.sh").match(/raw\.githubusercontent\.com[^"}]*/)[0], ps.match(/raw\.githubusercontent\.com[^"}]*/)[0], "stesso indirizzo di base");
});
