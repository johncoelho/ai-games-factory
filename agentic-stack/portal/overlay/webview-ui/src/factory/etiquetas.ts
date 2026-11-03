// Posicionamento das etiquetas dos agentes sem sobreposicao. Funcao unica: recebe as caixas ja projetadas (px de tela) e devolve o `top` ajustado
// de cada balao e de cada pilula, mais a flag de colapso para bolinha. Prioridade: humano (fixo) > balao (desvia de humano e de outro balao) > pilula
// (desvia de todos). Desvio so vertical, em degraus; pilha de pilulas acima de 2 degraus (ou pilula fora da sala) vira bolinha para o grupo todo.
export interface Caixa {
  l: number;
  t: number;
  w: number;
  h: number;
}
export interface ItemPilula {
  id: number;
  x: number; // centro da pilula
  base: number; // top natural
  w: number;
  h: number;
  pe: number; // y do pe (ordenacao)
  limite: { l: number; r: number; t: number } | null; // sala em que esta (a pilula nao pode sair dela)
}
export interface ItemBalao {
  id: number;
  x: number;
  base: number;
  w: number;
  h: number;
  pe: number;
  wCurto: number; // largura com o texto encurtado
  limite: { l: number; r: number; t: number } | null; // topo util da sala: o balao nunca fica acima dele
}
export interface PosBalao {
  t: number;
  cx: number; // centro
  w: number;
  curto: boolean;
  oculto: boolean; // nao coube: so a bolinha, com o texto no hover
}
export interface Posicao {
  top: number;
  degraus: number;
  natural: number; // degrau sem a retencao (histerese)
  colapsa: boolean;
}

const FOLGA = 2;
const MAX_DEGRAUS = 4;
const LIMITE_PILHA = 2;
const MAX_DEGRAUS_BALAO = 2;

const cruza = (al: number, at: number, aw: number, ah: number, b: Caixa): boolean => al - FOLGA < b.l + b.w + FOLGA && b.l - FOLGA < al + aw + FOLGA && at - FOLGA < b.t + b.h + FOLGA && b.t - FOLGA < at + ah + FOLGA;

const bate = (obst: Caixa[], l: number, t: number, w: number, h: number): boolean => {
  for (let i = 0; i < obst.length; i++) if (cruza(l, t, w, h, obst[i])) return true;
  return false;
};

export function posicionar(
  itens: ItemPilula[],
  baloes: ItemBalao[],
  fixas: Caixa[],
  sprites: Array<Caixa & { id: number }>,
  passo: number,
  todasBolinha: boolean,
  retidos: Map<number, number>,
): { pilulas: Map<number, Posicao>; baloes: Map<number, PosBalao> } {
  // baloes: sobem ate ficar livres de humanos e de outros baloes, sem passar do topo util da sala; se nao der, desvio lateral (ate 3 passos), depois texto curto, depois so a bolinha
  const baseObst = fixas.slice();
  const topoBalao = new Map<number, PosBalao>();
  for (const b of [...baloes].sort((p, q) => p.pe - q.pe || p.x - q.x)) {
    const lim = b.limite;
    const passoV = b.h + FOLGA;
    const topo0 = lim ? Math.max(b.base, lim.t) : b.base;
    let achou: PosBalao | null = null;
    for (const curto of [false, true]) {
      const w = curto ? b.wCurto : b.w;
      // o balao nao cobre etiqueta, humano, outro balao nem o sprite de outro agente
      const cabe = (cx: number, t: number) => {
        if (lim && (cx - w / 2 < lim.l || cx + w / 2 > lim.r || t < lim.t)) return false;
        if (bate(baseObst, cx - w / 2, t, w, b.h)) return false;
        for (let i = 0; i < sprites.length; i++) if (sprites[i].id !== b.id && cruza(cx - w / 2, t, w, b.h, sprites[i])) return false;
        return true;
      };
      for (let k = 0; k <= MAX_DEGRAUS_BALAO && !achou; k++) if (cabe(b.x, topo0 - k * passoV)) achou = { t: topo0 - k * passoV, cx: b.x, w, curto, oculto: false };
      for (let s = 1; s <= 3 && !achou; s++) {
        for (const sinal of [-1, 1]) {
          for (let k = 0; k <= MAX_DEGRAUS_BALAO && !achou; k++) {
            const t = topo0 - k * passoV;
            const cx = b.x + sinal * s * (w / 2 + FOLGA + 4);
            if (cabe(cx, t)) achou = { t, cx, w, curto, oculto: false };
          }
          if (achou) break;
        }
      }
      if (achou) break;
    }
    const res: PosBalao = achou ?? { t: topo0, cx: b.x, w: b.w, curto: false, oculto: true };
    topoBalao.set(b.id, res);
    if (!res.oculto) baseObst.push({ l: res.cx - res.w / 2, t: res.t, w: res.w, h: b.h });
  }

  const grupo = new Map<number, number>();
  const raiz = (i: number): number => {
    let r = i;
    while (grupo.get(r) !== r) r = grupo.get(r)!;
    grupo.set(i, r);
    return r;
  };
  const ordem = [...itens].sort((a, b) => a.pe - b.pe || a.x - b.x);
  for (const it of ordem) grupo.set(it.id, it.id);
  const ruim = new Set<number>();

  const avalia = (ignorar: Set<number>, bolinhas: Caixa[]) => {
    const obst = baseObst.concat(bolinhas);
    const donos: number[] = new Array(obst.length).fill(-1);
    const out = new Map<number, Posicao>();
    for (const it of ordem) {
      if (ignorar.has(it.id)) continue;
      const l = it.x - it.w / 2;
      let kn = 0;
      while (kn < MAX_DEGRAUS && bate(obst, l, it.base - kn * passo, it.w, it.h)) kn++;
      let k = Math.max(kn, retidos.get(it.id) ?? 0);
      while (k < MAX_DEGRAUS && bate(obst, l, it.base - k * passo, it.w, it.h)) k++;
      const t = it.base - k * passo;
      // pilulas que se tocam (no lugar natural ou no final) formam um grupo
      for (let i = 0; i < obst.length; i++) {
        const o = donos[i];
        if (o >= 0 && (cruza(l, it.base, it.w, it.h, obst[i]) || cruza(l, t, it.w, it.h, obst[i]))) grupo.set(raiz(it.id), raiz(o));
      }
      const lim = it.limite;
      const fora = !!lim && (t < lim.t || l < lim.l || l + it.w > lim.r);
      if (k > LIMITE_PILHA || fora || bate(obst, l, t, it.w, it.h)) ruim.add(it.id);
      obst.push({ l, t, w: it.w, h: it.h });
      donos.push(it.id);
      out.set(it.id, { top: t, degraus: k, natural: kn, colapsa: false });
    }
    return out;
  };

  const colapsados = new Set<number>();
  let final = avalia(colapsados, []);
  for (let volta = 0; volta < 8 && !todasBolinha && ruim.size > 0; volta++) {
    const raizes = new Set([...ruim].map((i) => raiz(i)));
    for (const it of ordem) if (raizes.has(raiz(it.id))) colapsados.add(it.id);
    ruim.clear();
    final = avalia(colapsados, ordem.filter((i) => colapsados.has(i.id)).map((i) => ({ l: i.x - 5, t: i.base + i.h - 10, w: 10, h: 10 })));
  }
  if (todasBolinha) for (const it of ordem) colapsados.add(it.id);
  const res = new Map<number, Posicao>();
  for (const it of ordem) res.set(it.id, colapsados.has(it.id) ? { top: it.base, degraus: 0, natural: 0, colapsa: true } : final.get(it.id)!);
  return { pilulas: res, baloes: topoBalao };
}
