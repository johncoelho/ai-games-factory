import { SB_KEY, SB_URL } from './config.js';
import { getMeta } from './meta.js';
import { sb } from './supabase.js';

export interface Issue {
  numero: number;
  titulo: string;
  url: string;
  etapa: string;
  privado?: boolean;
  rascunho?: boolean;
  fechado?: boolean;
}

// Etapa sem acento, sem caixa e sem espacos nas pontas: "Em Produção" == "em producao".
export const normEtapa = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export const AVISO_PRIVADO = 'Token sem a permissão repo: mostrando só os títulos. Com ela, aparecem número e link de cada issue.';
export const temPrivado = (itens: Issue[]): boolean => itens.some((i) => i.privado);
export type Resultado =
  | { estado: 'ok'; itens: Issue[]; etapas: string[] }
  | { estado: 'sem_token' }
  | { estado: 'erro'; msg: string };

// O quadro da esteira (GitHub) e o dono dos cartoes: aqui so se consulta, com cache curto, e nada e guardado.
const cache = new Map<string, { t: number; itens: Issue[] }>();
const cacheTodos = new Map<string, { t: number; itens: Issue[] }>();
const VALIDO_MS = 30_000;

async function quadro(game: string, todos = false): Promise<Issue[] | Resultado> {
  const c = todos ? cacheTodos : cache;
  const hit = c.get(game);
  if (hit && Date.now() - hit.t < VALIDO_MS) return hit.itens;
  const meta = await getMeta(game);
  if (!meta.quadro) return { estado: 'erro', msg: 'factory.yaml sem quadro' };
  const { data } = await sb.auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) return { estado: 'erro', msg: 'sem sessao' };
  const r = await fetch(
    `${SB_URL}/functions/v1/factory-board?owner=${encodeURIComponent(meta.quadro.owner)}&numero=${meta.quadro.numero}${todos ? '&todos=1' : ''}`,
    { headers: { authorization: `Bearer ${jwt}`, apikey: SB_KEY } },
  );
  if (r.status === 503) return { estado: 'sem_token' };
  if (!r.ok) return { estado: 'erro', msg: `HTTP ${r.status}` };
  const itens = ((await r.json()) as { itens: Issue[] }).itens;
  c.set(game, { t: Date.now(), itens });
  return itens;
}

export async function issuesDoPapel(game: string, role: string): Promise<Resultado> {
  if (import.meta.env.VITE_DEMO) {
    // ?demoissue=1: o suporte nao tem cartao na etapa dele (confere "Nenhuma issue em ..." com o agente parado)
    // ?demoitens=N: lista longa na etapa (confere o limite de altura do painel no celular)
    const nd = Number(new URLSearchParams(location.search).get('demoitens'));
    if (nd > 0 && role === 'po')
      return { estado: 'ok', etapas: ['Fila'], itens: Array.from({ length: nd }, (_, k) => ({ numero: 100 + k, titulo: 'Issue de exemplo numero ' + (k + 1) + ' com titulo comprido', url: '#', etapa: 'Fila' })) };
    if (role === 'suporte') return { estado: 'ok', etapas: ['Fila'], itens: [] };
    return {
      estado: 'ok',
      etapas: ['Em andamento'],
      itens: [{ numero: 64, titulo: 'Sair da conta deve limpar nome, avatar, frota e XP', url: '#', etapa: 'Em andamento' }],
    };
  }
  const meta = await getMeta(game);
  const etapas = meta.etapas[role] ?? [];
  if (etapas.length === 0) return { estado: 'ok', itens: [], etapas };
  const q = await quadro(game);
  if (!Array.isArray(q)) return q;
  const alvo = new Set(etapas.map(normEtapa));
  return { estado: 'ok', etapas, itens: q.filter((i) => alvo.has(normEtapa(i.etapa))) };
}

export interface IssueAgora {
  numero: number;
  /** URL do cartao no quadro, ou a montada de owner/repo quando a issue esta fora do quadro. */
  url: string;
  titulo?: string;
  /** false so quando o quadro foi lido e a issue nao esta nele; quadro indisponivel = undefined (nao afirma nada). */
  noQuadro?: boolean;
}

// "owner/repo#N" (o que o evento carrega) -> titulo do cache do quadro (o mesmo cache de 30 s). Fora do quadro: so o link.
export async function issueAgora(game: string, ref: string): Promise<IssueAgora> {
  const m = /^([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)#(\d+)$/.exec(ref);
  if (!m) return { numero: 0, url: '#' };
  const numero = Number(m[3]);
  const url = `https://github.com/${m[1]}/${m[2]}/issues/${numero}`;
  const demo = !!import.meta.env.VITE_DEMO;
  const q = demo ? await statusDoSquad(game) : await quadro(game);
  const todos = Array.isArray(q) ? q : q.estado === 'ok' ? q.itens : null;
  const itens = demo && todos ? todos.filter((i) => !i.privado) : todos; // demo: o cartao privado de exemplo nao deve esconder o "fora do quadro"
  if (!itens) return { numero, url };
  const alvo = `/${m[1]}/${m[2]}/issues/${numero}`.toLowerCase();
  const hit = itens.find((i) => i.numero === numero && (i.url === '#' || i.url.toLowerCase().endsWith(alvo)));
  if (hit) return { numero, url: hit.url === '#' ? url : hit.url, titulo: hit.titulo, noQuadro: true };
  // token sem permissao repo: cartoes privados chegam sem numero, entao nao da para afirmar que a issue esta fora do quadro
  return { numero, url, noQuadro: itens.some((i) => i.privado) ? undefined : false };
}

// Status do quadro inteiro do squad (reuniao): so o dono le, com o mesmo cache curto.
export async function statusDoSquad(game: string): Promise<Resultado> {
  if (import.meta.env.VITE_DEMO) {
    return {
      estado: 'ok',
      etapas: [],
      itens: [
        { numero: 64, titulo: 'Sair da conta deve limpar nome, avatar, frota e XP', url: '#', etapa: 'Publicado' },
        { numero: 62, titulo: 'Fila de partidas online', url: '#', etapa: 'Em andamento' },
        { numero: 0, titulo: 'Cartão de repositório privado (só título)', url: '#', etapa: 'Em andamento', privado: true },
      ],
    };
  }
  const q = await quadro(game);
  if (!Array.isArray(q)) return q;
  return { estado: 'ok', etapas: [], itens: q };
}

// Todos os cartoes do quadro (abertos e fechados): so para os indicadores da fabrica.
export async function statusDoSquadTodos(game: string): Promise<Resultado> {
  if (import.meta.env.VITE_DEMO) {
    if (new URLSearchParams(location.search).get('demoerro') === game) return { estado: 'erro', msg: 'HTTP 502' };
    const mk = (etapa: string, n: number): Issue[] =>
      Array.from({ length: n }, (_, k) => ({ numero: k + 1, titulo: etapa + ' ' + (k + 1), url: '#', etapa, fechado: /conclu|publicad|^em produ/i.test(etapa) }));
    const demo: Record<string, [string, number][]> = {
      'naval-battle': [['Aguardando aprovação', 6], ['Fila', 5], ['Liberado para testes', 7], ['Em produção', 21], ['Publicado', 1], ['Concluído', 24]],
      'agentic-stack': [['Publicado', 5]],
      'marketing-squad': [['Ideia', 7], ['Aguardando aprovação', 2], ['Construindo', 5], ['Concluído', 5]],
      ai4all: [['Novo', 2], ['Aguardando aprovação', 4], ['Fila', 3], ['Em andamento', 2], ['Em teste', 1], ['Pronto para produção', 1], ['Concluído', 6]],
    };
    return { estado: 'ok', etapas: [], itens: (demo[game] ?? []).flatMap(([e, n]) => mk(e, n)) };
  }
  const q = await quadro(game, true);
  if (!Array.isArray(q)) return q;
  return { estado: 'ok', etapas: [], itens: q };
}
