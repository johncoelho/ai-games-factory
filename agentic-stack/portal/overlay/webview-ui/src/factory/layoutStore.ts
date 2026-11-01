import { isOwner } from './session.js';
import { sb } from './supabase.js';

// Layout do escritorio: o mapa gerado e o padrao; o que o CEO salva no editor fica na tabela factory_layout (so ele escreve).
// O salvo so vale enquanto o padrao gerado nao mudou (assinatura em `base`), senao o mapa novo da fabrica prevalece.
let baseSig = '';

function assinatura(l: unknown): string {
  const s = JSON.stringify(l);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(36) + '-' + s.length;
}

export async function layoutSalvo<T>(padrao: T): Promise<T> {
  if (!padrao) return padrao;
  baseSig = assinatura(padrao);
  try {
    const { data } = await sb.from('factory_layout').select('layout,base').eq('id', 'main').maybeSingle();
    if (data && data.base === baseSig) return data.layout as T;
  } catch {
    /* sem banco: fica o padrao */
  }
  return padrao;
}

let timer: ReturnType<typeof setTimeout> | null = null;
export function guardarLayout(layout: Record<string, unknown>): void {
  if (!isOwner() || !baseSig) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void sb.from('factory_layout').upsert({ id: 'main', layout, base: baseSig, updated_at: new Date().toISOString() });
  }, 600);
}
