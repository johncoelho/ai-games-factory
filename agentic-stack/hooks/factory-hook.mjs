#!/usr/bin/env node
// Hook do Claude Code -> evento da fabrica. Nunca bloqueia o agente: sempre sai com 0.
// Privacidade: envia so nome da ferramenta e caminho de arquivo relativo. Nao envia comando, prompt nem resposta.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Eventos cobertos (registrar cada um em .claude/settings*.json): SessionStart, PreToolUse, PermissionRequest, Stop
// e, alem deles, SessionEnd, PostToolUse, SubagentStart/Stop, Notification, UserPromptSubmit.
// Este hook SO observa. Em PermissionRequest (e em qualquer evento) a saida padrao de um hook pode aprovar,
// negar ou injetar contexto; por isso nada pode sair em stdout/stderr. Trava aqui, vale para codigo futuro tambem.
process.stdout.write = () => true;
process.stderr.write = () => true;

// Padrao = Supabase da fabrica (base jarvis-agentic-stack). A chave e a publicavel (so insere; ler exige login), feita para ser publica.
// O bloco "env" do settings.local.json nao chegou aos hooks nos testes reais, por isso o padrao fica aqui.
const URL_ = process.env.FACTORY_EVENTS_URL || "https://lwaoxnjajxljxusxujku.supabase.co/rest/v1/factory_events";
const KEY = process.env.FACTORY_EVENTS_KEY || "sb_publishable_DAh62u94eXqLOLJCe0mPXA_nykm2Xhd";
const LOCAL_URL = process.env.FACTORY_LOCAL_URL ?? "http://127.0.0.1:4010/events"; // "off" desliga

function readStdin() {
  return new Promise((resolve) => {
    let s = "";
    const t = setTimeout(() => resolve(s), 1500);
    process.stdin.on("data", (d) => (s += d)).on("end", () => (clearTimeout(t), resolve(s)));
  });
}

// slug do jogo: factory.yaml mais proximo (sobe a partir do cwd) ou FACTORY_GAME
function gameSlug(cwd) {
  if (process.env.FACTORY_GAME) return process.env.FACTORY_GAME;
  let dir = cwd;
  for (let i = 0; i < 6 && dir; i++) {
    try {
      const m = /^slug:\s*(\S+)/m.exec(fs.readFileSync(path.join(dir, "factory.yaml"), "utf8"));
      if (m) return m[1];
    } catch {}
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return path.basename(cwd || "desconhecido");
}

// custo acumulado da sessao: ultimo registro cost-state do transcript
function sessionCost(transcript) {
  try {
    const st = fs.statSync(transcript);
    const fd = fs.openSync(transcript, "r");
    const len = Math.min(st.size, 200_000);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, st.size - len);
    fs.closeSync(fd);
    const lines = buf.toString("utf8").split("\n").reverse();
    for (const l of lines) {
      if (!l.includes('"cost-state"')) continue;
      const j = JSON.parse(l);
      if (typeof j.totalCostUSD === "number") return j.totalCostUSD;
    }
  } catch {}
  return null;
}

// issue ativa (owner/repo#N), sem rede e sem ler o prompt. Ordem: env FACTORY_ISSUE; branch (issue-<n> ou <n>-slug) + remote origin.
// Worktree: ".git" e um arquivo "gitdir: ..." e o config fica no diretorio comum (arquivo commondir). Qualquer falha = sem issue.
const ISSUE_RE = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}#[0-9]{1,7}$/;
function gitDirs(cwd) {
  let dir = cwd;
  for (let i = 0; i < 12 && dir; i++) {
    const g = path.join(dir, ".git");
    try {
      const st = fs.statSync(g);
      if (st.isDirectory()) return { head: path.join(g, "HEAD"), common: g };
      const m = /^gitdir:\s*(.+)$/m.exec(fs.readFileSync(g, "utf8"));
      if (m) {
        const gd = path.resolve(dir, m[1].trim());
        let common = gd;
        try {
          common = path.resolve(gd, fs.readFileSync(path.join(gd, "commondir"), "utf8").trim());
        } catch {}
        return { head: path.join(gd, "HEAD"), common };
      }
    } catch {}
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}
function repoOrigin(common) {
  try {
    const cfg = fs.readFileSync(path.join(common, "config"), "utf8");
    const sec = /\[remote "origin"\]([^[]*)/.exec(cfg)?.[1] || "";
    const url = /^\s*url\s*=\s*(.+?)\s*$/m.exec(sec)?.[1] || "";
    const m = /github\.com[:/]([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/.exec(url);
    return m && m[2] !== "." && m[2] !== ".." ? `${m[1]}/${m[2]}` : null;
  } catch {
    return null;
  }
}
function activeIssue(cwd) {
  try {
    const env = (process.env.FACTORY_ISSUE || "").trim();
    if (ISSUE_RE.test(env) && Number(env.split("#")[1]) > 0 && !/\/\.{1,2}#/.test(env)) return env;
    if (!cwd) return null;
    const g = gitDirs(cwd);
    if (!g) return null;
    const repo = repoOrigin(g.common);
    const num = /^\d{1,7}$/.exec(env.replace(/^#/, ""))?.[0]; // FACTORY_ISSUE so com o numero: usa o remote
    let n = num;
    if (!n) {
      const br = /^ref:\s*refs\/heads\/(\S+)/.exec(fs.readFileSync(g.head, "utf8"))?.[1] || "";
      n = /^issue-(\d{1,7})$/.exec(br)?.[1] || /^(\d{1,7})-[a-z][a-z0-9._-]*$/.exec(br)?.[1];
    }
    if (!n || Number(n) === 0 || !repo) return null;
    const r = `${repo}#${Number(n)}`;
    return ISSUE_RE.test(r) ? r : null;
  } catch {
    return null;
  }
}

function target(h) {
  const i = h.tool_input || {};
  const f = i.file_path || i.path || i.notebook_path;
  if (f) return path.relative(h.cwd || "", f).replaceAll("\\", "/").slice(0, 160);
  if (h.tool_name === "Grep" || h.tool_name === "Glob") return String(i.pattern || "").slice(0, 80);
  return null;
}

try {
  const h = JSON.parse((await readStdin()) || "{}");
  const ev = h.hook_event_name;
  const e = {
    ts: new Date().toISOString(),
    game: gameSlug(h.cwd),
    session_id: h.session_id,
    agent: process.env.FACTORY_AGENT || h.agent_type || "principal",
    agent_id: h.agent_id || null,
    event: ev,
    tool: h.tool_name || null,
    target: target(h),
    duration_ms: h.duration_ms ?? null,
    cost_usd: ["Stop", "SessionEnd", "SubagentStop"].includes(ev) ? sessionCost(h.transcript_path) : null,
  };
  const issue = activeIssue(h.cwd);
  if (issue) e.issue = issue; // evento sem issue nao manda o campo
  const body = JSON.stringify(e);
  const send = (url, key) =>
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...(key ? { apikey: key, authorization: `Bearer ${key}` } : {}) },
      body,
      signal: AbortSignal.timeout(1500),
    });
  // Destino principal (Supabase) e, em paralelo, o painel local (so a demo; some em silencio se nao estiver no ar).
  const sends = [send(URL_, KEY)];
  if (LOCAL_URL && LOCAL_URL !== "off" && LOCAL_URL !== URL_) sends.push(send(LOCAL_URL, ""));
  const res = await Promise.allSettled(sends);
  // Diagnostico local: so registra falhas (nunca o conteudo do evento).
  const falhas = res
    .map((r, i) => (r.status === "rejected" ? `${i}: ${r.reason?.cause?.code || r.reason?.name || r.reason}` : !r.value.ok ? `${i}: HTTP ${r.value.status}` : null))
    .filter(Boolean);
  if (falhas.length) {
    try {
      const f = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "hook.log");
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.appendFileSync(f, `${e.ts} ${ev} destino=${URL_.slice(0, 40)} ${falhas.join(" | ")}\n`);
    } catch {}
  }
} catch {}
process.exitCode = 0; // sem process.exit(): no Windows ele derruba o Node com conexoes ainda fechando
