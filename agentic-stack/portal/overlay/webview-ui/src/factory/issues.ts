import { SB_KEY, SB_URL } from './config.js';
import { getMeta } from './meta.js';
import { sb } from './supabase.js';

export interface Issue {
  numero: number;
  titulo: string;
  url: string;
  etapa: string;
}
export type Resultado =
  | { estado: 'ok'; itens: Issue[]; etapas: string[] }
  | { estado: 'sem_token' }
  | { estado: 'erro'; msg: string };

// O quadro da esteira (GitHub) e o dono dos cartoes: aqui so se consulta, com cache curto, e nada e guardado.
const cache = new Map<string, { t: number; itens: Issue[] }>();
const VALIDO_MS = 30_000;

async function quadro(game: string): Promise<Issue[] | Resultado> {
  const hit = cache.get(game);
  if (hit && Date.now() - hit.t < VALIDO_MS) return hit.itens;
  const meta = await getMeta(game);
  if (!meta.quadro) return { estado: 'erro', msg: 'factory.yaml sem quadro' };
  const { data } = await sb.auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) return { estado: 'erro', msg: 'sem sessao' };
  const r = await fetch(
    `${SB_URL}/functions/v1/factory-board?owner=${encodeURIComponent(meta.quadro.owner)}&numero=${meta.quadro.numero}`,
    { headers: { authorization: `Bearer ${jwt}`, apikey: SB_KEY } },
  );
  if (r.status === 503) return { estado: 'sem_token' };
  if (!r.ok) return { estado: 'erro', msg: `HTTP ${r.status}` };
  const itens = ((await r.json()) as { itens: Issue[] }).itens;
  cache.set(game, { t: Date.now(), itens });
  return itens;
}

export async function issuesDoPapel(game: string, role: string): Promise<Resultado> {
  if (import.meta.env.VITE_DEMO) {
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
  return { estado: 'ok', etapas, itens: q.filter((i) => etapas.includes(i.etapa)) };
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
      ],
    };
  }
  const q = await quadro(game);
  if (!Array.isArray(q)) return q;
  return { estado: 'ok', etapas: [], itens: q };
}
