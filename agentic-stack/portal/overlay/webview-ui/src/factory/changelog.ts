// Release notes do jogo: o CHANGELOG.md do repo e o dono da informacao; aqui so se le e se filtra por data (nada e guardado).
export interface Entrega {
  data: string;
  versao: string;
  titulo: string;
}
export type Entregas = { estado: 'ok'; itens: Entrega[] } | { estado: 'indisponivel' };

const cache = new Map<string, { t: number; p: Promise<Entregas> }>();

// aceita "## [0.43.2] — 2026-11-01 · titulo" (versao com data) e "- 2026-09-12 · texto" (linha por data)
export function parseChangelog(txt: string): Entrega[] {
  const out: Entrega[] = [];
  for (const raw of txt.split(String.fromCharCode(10))) {
    const l = raw.trim();
    const h = /^##\s*\[?([^\]\s]+)\]?\s*[—–-]\s*(\d{4}-\d{2}-\d{2})\s*[·—–-]?\s*(.*)$/.exec(l);
    if (h) {
      out.push({ versao: h[1], data: h[2], titulo: h[3] || 'versão ' + h[1] });
      continue;
    }
    const b = /^[-*]\s*(\d{4}-\d{2}-\d{2})\s*[·—–-]\s*(.*)$/.exec(l);
    if (b) out.push({ versao: '', data: b[1], titulo: b[2] });
  }
  return out;
}

export function entregas(game: string): Promise<Entregas> {
  const hit = cache.get(game);
  if (hit && Date.now() - hit.t < 60_000) return hit.p;
  const p = fetch(`https://raw.githubusercontent.com/johncoelho/${game}/main/CHANGELOG.md`)
    .then((r) => (r.ok ? r.text().then((t): Entregas => ({ estado: 'ok', itens: parseChangelog(t) })) : ({ estado: 'indisponivel' } as Entregas)))
    .catch((): Entregas => ({ estado: 'indisponivel' }));
  cache.set(game, { t: Date.now(), p });
  return p;
}
