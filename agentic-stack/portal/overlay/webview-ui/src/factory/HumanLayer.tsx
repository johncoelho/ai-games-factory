import { useEffect, useRef, useState } from 'react';

import { CHARACTER_SITTING_OFFSET_PX, TOOL_OVERLAY_VERTICAL_OFFSET } from '../constants.js';
import type { OfficeState } from '../office/engine/officeState.js';
import { overlayProjection } from '../office/projection.js';
import { CharacterState } from '../office/types.js';
import { sair } from './gate.js';
import { type Caixa, type ItemBalao, type ItemPilula, posicionar } from './etiquetas.js';
import { IndicadoresFabrica, KanbanSquad } from './Quadros.js';
import { Recados } from './Recados.js';
import { Reuniao } from './Reuniao.js';
import { registry } from './registry.js';
import { sb } from './supabase.js';
import { roleLabel, roleSigla } from './roles.js';
import { ROOMS } from './rooms.js';
import { MY_ID, isOwner, me } from './session.js';
import { Voz } from './voz.js';

interface Props {
  officeState: OfficeState;
  containerRef: { current: HTMLDivElement | null };
  zoom: number;
  panRef: { current: { x: number; y: number } };
}

interface Perto {
  nome: string;
  papel: string;
  squad: string;
  atividade: string;
}

const BIA_ID = 90999;
const TESTE = import.meta.env.DEV || new URLSearchParams(location.search).has('teste');
let _ctx: CanvasRenderingContext2D | null = null;
const _cacheLarg = new Map<string, number>();
const larguraTexto = (fonte: string, texto: string, espaco = 0): number => {
  const chave = fonte + '|' + espaco + '|' + texto;
  const c = _cacheLarg.get(chave);
  if (c !== undefined) return c;
  _ctx ??= document.createElement('canvas').getContext('2d');
  let w = texto.length * 7;
  if (_ctx) {
    _ctx.font = fonte;
    w = _ctx.measureText(texto).width + espaco * texto.length;
  }
  if (_cacheLarg.size > 500) _cacheLarg.clear();
  _cacheLarg.set(chave, w);
  return w;
};
const MONO = "ui-monospace,Consolas,'JetBrains Mono',monospace";

// Avatares humanos (CEO e visitantes), etiquetas que distinguem humano de agente (IA) e o painel de quem esta por perto.
export function HumanLayer({ officeState, containerRef, zoom, panRef }: Props) {
  const [, setTick] = useState(0);
  const [perto, setPerto] = useState<Perto | null>(null);
  const [mic, setMic] = useState(false);
  const [micMsg, setMicMsg] = useState('');
  const alternarMic = useRef<() => void>(() => undefined);
  const [reuniao, setReuniao] = useState<string | null>(null);
  const reuniaoRef = useRef<string | null>(null);
  const bolinhasRef = useRef(new Map<number, number | null>());
  const degrausRef = useRef(new Map<number, { k: number; desde: number | null }>());
  const [sobreId, setSobreId] = useState<number | null>(null);
  const [painel, setPainel] = useState<{ tipo: 'kanban'; game: string } | { tipo: 'ind' } | null>(null);
  const [sobre, setSobre] = useState('');
  const [biaFala, setBiaFala] = useState('');
  const [naoLidos, setNaoLidos] = useState(0);

  // recepcionista: confirma o recado anotado e avisa o CEO de quantos esperam na caixa de entrada
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const anotado = () => {
      setBiaFala('Anotado! Já está na caixa do John.');
      if (t) clearTimeout(t);
      t = setTimeout(() => setBiaFala(''), 7000);
    };
    const lidos = (e: Event) => setNaoLidos((e as CustomEvent<number>).detail ?? 0);
    window.addEventListener('factory-recado-anotado', anotado);
    window.addEventListener('factory-recados-nao-lidos', lidos);
    return () => {
      window.removeEventListener('factory-recado-anotado', anotado);
      window.removeEventListener('factory-recados-nao-lidos', lidos);
      if (t) clearTimeout(t);
    };
  }, []);

  // quadro a quadro: reposiciona as etiquetas
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setTick((n) => n + 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // meu avatar: o CEO nasce sentado na cadeira da sala dele; o visitante, num sofa da recepcao
  useEffect(() => {
    const win = window as unknown as { __factoryOffice?: OfficeState; __factoryTileClick?: (c: number, r: number) => boolean };
    win.__factoryOffice = officeState;
    let feito = false;
    const t = setInterval(() => {
      if (feito || officeState.seats.size === 0) return;
      feito = true;
      clearInterval(t);
      // a recepcionista (Bia) senta na mesa da recepcao antes de qualquer visitante escolher lugar
      const recepcao = ROOMS.find((r) => r.type === 'reception');
      if (recepcao?.seat) {
        let bsid: string | null = null;
        for (const [sid, s] of officeState.seats) if (s.seatCol === recepcao.seat.col && s.seatRow === recepcao.seat.row) bsid = sid;
        officeState.addHuman(BIA_ID, 13, 0, bsid, 'Bia', 'recep', recepcao.seat.col, recepcao.seat.row);
      }
      let seatId: string | null = null;
      if (isOwner()) {
        const seat = ROOMS.find((r) => r.type === 'ceo')?.seat;
        for (const [sid, s] of officeState.seats) if (seat && s.seatCol === seat.col && s.seatRow === seat.row) seatId = sid;
      } else {
        const rec = ROOMS.find((r) => r.type === 'reception');
        for (const [sid, s] of officeState.seats) {
          if (s.assigned || !rec) continue;
          if (s.seatCol >= rec.x && s.seatCol < rec.x + rec.w && s.seatRow >= rec.y && s.seatRow < rec.y + rec.h) {
            seatId = sid;
            break;
          }
        }
      }
      officeState.addHuman(MY_ID, me.palette, 0, seatId, me.name || 'Você', isOwner() ? 'ceo' : 'visitor', 25, 14);
    }, 250);
    win.__factoryTileClick = (col, row) => officeState.humanGoTo(MY_ID, col, row);
    return () => {
      clearInterval(t);
      win.__factoryTileClick = undefined;
    };
  }, [officeState]);

  // reuniao: o avatar do CEO vai sozinho para a sala junto com o time e, ao encerrar, volta de onde saiu
  const antesRef = useRef<{ col: number; row: number } | null>(null);
  useEffect(() => {
    if (!isOwner()) return;
    const eu = officeState.characters.get(MY_ID);
    if (!eu) return;
    const sala = ROOMS.find((r) => r.type === 'meeting');
    const dentro = (c: number, r: number) => !!sala && c >= sala.x && c < sala.x + sala.w && r >= sala.y && r < sala.y + sala.h;
    if (reuniao) {
      if (!sala) return;
      const fim = eu.path.length ? eu.path[eu.path.length - 1] : { col: eu.tileCol, row: eu.tileRow };
      if (dentro(fim.col, fim.row)) return;
      antesRef.current = { col: fim.col, row: fim.row };
      const cx = sala.x + 4;
      const cy = sala.y + 4;
      const dist = (c: number, r: number) => Math.abs(c - cx) + Math.abs(r - cy);
      const assentos: Array<[number, number]> = [];
      for (const s of officeState.seats.values()) if (!s.assigned && dentro(s.seatCol, s.seatRow)) assentos.push([s.seatCol, s.seatRow]);
      assentos.sort((p, q) => dist(p[0], p[1]) - dist(q[0], q[1]));
      const chao: Array<[number, number]> = [];
      for (let c = sala.x; c < sala.x + sala.w; c++) for (let r = sala.y; r < sala.y + sala.h; r++) chao.push([c, r]);
      chao.sort((p, q) => dist(p[0], p[1]) - dist(q[0], q[1]));
      // a cadeira da cabeceira e reservada ao CEO em todas as janelas (os agentes nunca sentam nela)
      const reservada: Array<[number, number]> = [[sala.x + 4, sala.y + 2]];
      for (const [c, r] of [...reservada, ...assentos, ...chao]) if (officeState.humanGoTo(MY_ID, c, r)) return;
      antesRef.current = null;
    } else if (antesRef.current) {
      const volta = antesRef.current;
      antesRef.current = null;
      // so volta se ainda estiver na sala (se ele mesmo ja saiu andando, nao mexe)
      const agora = eu.path.length ? eu.path[eu.path.length - 1] : { col: eu.tileCol, row: eu.tileRow };
      if (!dentro(agora.col, agora.row)) return;
      if (officeState.humanGoTo(MY_ID, volta.col, volta.row)) return;
      const ceo = ROOMS.find((r) => r.type === 'ceo')?.seat;
      if (ceo) officeState.humanGoTo(MY_ID, ceo.col, ceo.row);
    }
  }, [reuniao, officeState]);

  // teclado: setas ou WASD movem meu avatar um tile
  useEffect(() => {
    const dir: Record<string, [number, number]> = {
      ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
      ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
      ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
      ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
    };
    const onKey = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const d = dir[e.key];
      if (!d) return;
      const ch = officeState.characters.get(MY_ID);
      if (!ch) return;
      e.preventDefault();
      if (ch.path.length === 0) officeState.humanGoTo(MY_ID, ch.tileCol + d[0], ch.tileRow + d[1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [officeState]);

  // presenca: CEO e visitantes online se enxergam (canal publico do Supabase Realtime). Sem o CEO online, um avatar dele fica sentado na sala.
  useEffect(() => {
    type P = { name: string; palette: number; kind: 'ceo' | 'visitor'; col: number; row: number; x?: number; y?: number; d?: number; sit?: boolean; mic?: boolean; t?: number; meeting?: string | null };
    type Pos = { x: number; y: number; d: number; s: boolean };
    const meuKey = Math.random().toString(36).slice(2);
    const canal = sb.channel(location.hostname === 'localhost' ? 'factory-presence-dev' : 'factory-presence', { config: { presence: { key: meuKey } } });
    const remotos = new Map<string, number>();
    const ultimosP = new Map<string, P>();
    // posicao exata de cada pessoa online (px), recebida a ~10 vezes por segundo: todas as telas mostram o mesmo XY
    const posRemota = new Map<string, Pos>();
    const sumiuEm = new Map<string, number>();
    // ultima vez (relogio local) que ouvimos sinal de vida de cada pessoa: posicao ou re-registro de presenca. Sem sinal por 30 s, a pessoa saiu mesmo que a presenca nao avise.
    const sinalEm = new Map<string, number>();
    const assentoRemoto = new Map<string, string>();
    const aplicarPos = (k: string, pos: Pos) => {
      posRemota.set(k, pos);
      sinalEm.set(k, Date.now());
      const cid = remotos.get(k);
      const ch = cid === undefined ? undefined : officeState.characters.get(cid);
      if (!ch || cid === undefined) return;
      ch.remote = { x: pos.x, y: pos.y, dir: pos.d, sit: pos.s };
      // quem esta sentado ocupa o assento (ninguem mais senta nele); ao levantar, libera
      const col = Math.floor(pos.x / 16);
      const row = Math.floor(pos.y / 16);
      const atual = assentoRemoto.get(k) ?? null;
      const alvo = pos.s ? seatAt(col, row) : null;
      if (atual !== alvo) {
        if (atual) {
          const st = officeState.seats.get(atual);
          if (st) st.assigned = false;
          assentoRemoto.delete(k);
        }
        if (alvo) {
          const st = officeState.seats.get(alvo);
          if (st && !st.assigned) {
            st.assigned = true;
            assentoRemoto.set(k, alvo);
          }
        }
      }
    };
    const voz = new Voz(meuKey, (sinal) => void canal.send({ type: 'broadcast', event: 'rtc', payload: sinal }));
    (window as unknown as { __factoryVoz?: Voz }).__factoryVoz = voz;
    let seq = 91000;
    let meetingRemoto: string | null = null;
    let npc: number | null = null;
    const seatAt = (col: number, row: number): string | null => {
      for (const [sid, st] of officeState.seats) if (st.seatCol === col && st.seatRow === row) return sid;
      return null;
    };
    const sync = () => {
      const estado = canal.presenceState() as unknown as Record<string, P[]>;
      const vistos = new Set<string>();
      let ceoOnline = isOwner();
      // O CEO e uma pessoa so: com varias janelas dele abertas, vale a que mexeu por ultimo (e quem e o CEO nao enxerga as outras janelas).
      let ceoKey: string | null = null;
      let ceoT = -1;
      for (const [k, arr] of Object.entries(estado)) {
        const p = arr[arr.length - 1];
        if (k !== meuKey && p?.kind === 'ceo' && (p.t ?? 0) > ceoT) {
          ceoT = p.t ?? 0;
          ceoKey = k;
        }
      }
      for (const [k, arr] of Object.entries(estado)) {
        const p = arr[arr.length - 1];
        if (k === meuKey || !p) continue;
        if (ultimosP.get(k)?.t !== p.t || !sinalEm.has(k)) sinalEm.set(k, Date.now());
        if (Date.now() - (sinalEm.get(k) ?? 0) > 30_000) continue;
        if (p.kind === 'ceo' && (isOwner() || k !== ceoKey)) continue;
        vistos.add(k);
        ultimosP.set(k, p);
        if (p.kind === 'ceo') ceoOnline = true;
        const cid = remotos.get(k);
        if (cid === undefined) {
          const novo = seq++;
          remotos.set(k, novo);
          officeState.addHuman(novo, p.palette, 0, null, p.name, p.kind, p.col, p.row);
          aplicarPos(k, posRemota.get(k) ?? { x: p.x ?? p.col * 16 + 8, y: p.y ?? p.row * 16 + 8, d: p.d ?? 0, s: p.sit ?? false });
        }
      }
      for (const [k, cid] of remotos) {
        if (vistos.has(k)) {
          sumiuEm.delete(k);
          continue;
        }
        // tolerancia de 6 s: uma queda curta de conexao ou o re-registro da presenca nao pode fazer o avatar piscar e sumir
        const desde = sumiuEm.get(k) ?? Date.now();
        sumiuEm.set(k, desde);
        if (Date.now() - desde < 6000) continue;
        sumiuEm.delete(k);
        const as = assentoRemoto.get(k);
        if (as) {
          const st = officeState.seats.get(as);
          if (st) st.assigned = false;
          assentoRemoto.delete(k);
        }
        officeState.removeAgent(cid);
        remotos.delete(k);
        ultimosP.delete(k);
        posRemota.delete(k);
      }
      // reuniao: o CEO chama o time de um produto; todos veem esses agentes irem para a sala de reuniao
      meetingRemoto = ceoKey ? (estado[ceoKey]?.slice(-1)[0]?.meeting ?? null) : null;
      officeState.factoryMeeting(isOwner() ? reuniaoRef.current : meetingRemoto);
      const sala = ROOMS.find((r) => r.type === 'ceo')?.seat;
      if (!ceoOnline && npc === null && sala) {
        npc = seq++;
        officeState.addHuman(npc, 1, 0, seatAt(sala.col, sala.row), 'John', 'ceo', sala.col, sala.row);
      } else if (ceoOnline && npc !== null) {
        officeState.removeAgent(npc);
        npc = null;
      }
    };
    let ultimo = '';
    let ultimoTrack = 0;
    let ultimaPos = '';
    let ultimoPos = 0;
    const reafirmar = () => {
      ultimo = '';
    };
    window.addEventListener('online', reafirmar);
    document.addEventListener('visibilitychange', reafirmar);
    let t: ReturnType<typeof setInterval> | null = null;
    let varre: ReturnType<typeof setInterval> | null = null;
    let v: ReturnType<typeof setInterval> | null = null;
    alternarMic.current = () => {
      if (voz.ligado) {
        voz.desligar();
        setMic(false);
        setMicMsg('');
        return;
      }
      void voz.ligar().then((ok) => {
        setMic(ok);
        setMicMsg(ok ? 'conversa por voz com quem estiver por perto' : 'microfone bloqueado no navegador');
      });
    };
    const iniciar = setInterval(() => {
      if (!officeState.characters.has(MY_ID)) return;
      clearInterval(iniciar);
      canal.on('broadcast', { event: 'rtc' }, ({ payload }) => void voz.sinal(payload as never));
      canal.on('broadcast', { event: 'pos' }, ({ payload }) => {
        const m = payload as { k: string; x: number; y: number; d: number; s: boolean };
        if (m?.k && m.k !== meuKey) aplicarPos(m.k, { x: m.x, y: m.y, d: m.d, s: m.s });
      });
      canal.on('presence', { event: 'sync' }, sync).subscribe((st) => {
        if (st !== 'SUBSCRIBED') return;
        sync();
        varre = setInterval(sync, 2000);
        t = setInterval(() => {
          const eu = officeState.characters.get(MY_ID);
          if (!eu) return;
          officeState.factoryMeeting(isOwner() ? reuniaoRef.current : meetingRemoto);
          const agora = Date.now();
          const sit = eu.state === CharacterState.TYPE;
          // posicao exata e direcao a ~10 Hz quando muda, e um batimento a cada 1,5 s parado: o mapa fica igual em todas as telas
          const pos = Math.round(eu.x * 10) + ',' + Math.round(eu.y * 10) + ',' + eu.dir + ',' + sit;
          if (pos !== ultimaPos || agora - ultimoPos > 1500) {
            ultimaPos = pos;
            ultimoPos = agora;
            void canal.send({ type: 'broadcast', event: 'pos', payload: { k: meuKey, x: Math.round(eu.x * 10) / 10, y: Math.round(eu.y * 10) / 10, d: eu.dir, s: sit } });
          }
          // cadastro (nome, avatar, microfone, reuniao): so quando muda e a cada 15 s; tambem leva a posicao de entrada
          const chave = voz.ligado + ',' + reuniaoRef.current;
          if (chave === ultimo && agora - ultimoTrack < 15_000) return;
          ultimo = chave;
          ultimoTrack = agora;
          void canal.track({ name: me.name, palette: me.palette, kind: isOwner() ? 'ceo' : 'visitor', col: eu.tileCol, row: eu.tileRow, x: eu.x, y: eu.y, d: eu.dir, sit, mic: voz.ligado, t: agora, meeting: isOwner() ? reuniaoRef.current : null });
        }, 100);
        // voz: quem esta a ate 4 tiles (e ainda ate 6 se ja conectado) e tambem esta com o microfone ligado
        v = setInterval(() => {
          const eu = officeState.characters.get(MY_ID);
          if (!eu) return;
          const conectados = new Set(voz.conectados());
          const alvo = new Map<string, number>();
          for (const [k, cid] of remotos) {
            const c = officeState.characters.get(cid);
            if (!c) continue;
            const d = Math.hypot(c.tileCol - eu.tileCol, c.tileRow - eu.tileRow);
            if (d <= (conectados.has(k) ? 11 : 9)) alvo.set(k, d);
          }
          voz.atualizar(alvo);
        }, 700);
      });
    }, 300);
    return () => {
      clearInterval(iniciar);
      window.removeEventListener('online', reafirmar);
      document.removeEventListener('visibilitychange', reafirmar);
      if (t) clearInterval(t);
      if (varre) clearInterval(varre);
      if (v) clearInterval(v);
      voz.encerrar();
      void sb.removeChannel(canal);
    };
  }, [officeState]);

  // quem esta por perto (ate 3 tiles) e o que esta fazendo
  useEffect(() => {
    const t = setInterval(() => {
      const eu = officeState.characters.get(MY_ID);
      if (!eu) return;
      let melhor: { id: number; d: number } | null = null;
      for (const id of registry.agentIds()) {
        const c = officeState.characters.get(id);
        if (!c) continue;
        const d = Math.hypot(c.tileCol - eu.tileCol, c.tileRow - eu.tileRow);
        if (d <= 3 && (!melhor || d < melhor.d)) melhor = { id, d };
      }
      if (!melhor) return setPerto(null);
      const info = registry.agent(melhor.id);
      if (!info) return setPerto(null);
      setPerto({
        nome: info.nome,
        papel: roleLabel(info.role, info.game),
        squad: registry.squad(info.game) ?? info.game,
        atividade: registry.activity(melhor.id) || 'parado',
      });
    }, 350);
    return () => clearInterval(t);
  }, [officeState]);

  const el = containerRef.current;
  if (!el) return null;
  const t0 = TESTE ? performance.now() : 0;
  const dpr = window.devicePixelRatio || 1;
  const project = overlayProjection(officeState.getLayout(), el.getBoundingClientRect(), zoom, panRef.current, dpr);
  const nodes: React.ReactNode[] = [];
  if (TESTE) {
    const w = window as unknown as { __factoryProj?: unknown; __factoryZoom?: number };
    w.__factoryProj = project;
    w.__factoryZoom = zoom;
  }
  const ph = zoom >= 3 ? 19 : zoom >= 2 ? 17 : 15;
  const pf = zoom >= 3 ? 11 : zoom >= 2 ? 10 : 9;
  const passo = ph + 2;
  const baloes: Array<ItemBalao & { texto: string; cor: string }> = [];
  const limiteSala = (tc: number, tr: number) => {
    // topo do piso: quem esta na porta (linha logo acima do piso) conta como da sala, para o balao nao subir sobre a parede
    const sala = ROOMS.find((r) => tc >= r.x && tc < r.x + r.w && tr >= r.y - 1 && tr < r.y + r.h);
    return sala ? { l: project.toScreenX(sala.x * 16), r: project.toScreenX((sala.x + sala.w) * 16), t: project.toScreenY(sala.y * 16) } : null;
  };
  const MONO_B = '11px ' + MONO;
  const fixas: Caixa[] = [];
  const sprites: Array<Caixa & { id: number }> = [];
  const esc = (project.toScreenX(16) - project.toScreenX(0)) / 16; // px de tela por px do mundo
  const pilulas: Array<{ id: number; x: number; sigla: string; corSt: string; sentado: number; chy: number; tc: number; tr: number }> = [];
  const MONO_FONTE = (px: number) => '700 ' + px + 'px ' + MONO;

  for (const [id, ch] of officeState.characters) {
    const x = project.toScreenX(ch.x);
    const pes = project.toScreenY(ch.y);
    if (ch.isHuman) {
      const ceo = ch.humanKind === 'ceo';
      const recep = ch.humanKind === 'recep';
      const cor = ceo ? '#FFC95C' : recep ? '#F29BC4' : '#6FCF97';
      const sentado = ch.state === CharacterState.TYPE ? CHARACTER_SITTING_OFFSET_PX : 0;
      const topo = project.toScreenY(ch.y + sentado - TOOL_OVERLAY_VERTICAL_OFFSET);
      const larg = (18 * zoom) / dpr;
      {
        const rotulo = ceo ? 'CEO' : recep ? 'RECEPÇÃO' : 'VISITANTE';
        const wh = Math.max(larguraTexto(MONO_FONTE(10), rotulo, 1) + 14, larguraTexto(MONO_FONTE(13), ch.humanName ?? ''));
        fixas.push({ l: x - wh / 2, t: topo - 30, w: wh, h: 32 });
        // o corpo do humano (sprite e anel) tambem e obstaculo fixo: balao e pilula nao o cobrem
        const lb = Math.max(larg, 16 * esc);
        fixas.push({ l: x - lb / 2, t: topo + 2, w: lb, h: pes + larg * 0.28 - topo - 2 });
      }
      nodes.push(
        <div
          key={'anel' + id}
          style={{ position: 'absolute', left: x - larg / 2, top: pes - larg * 0.28, width: larg, height: larg * 0.56, border: '2px solid ' + cor, borderRadius: '50%', pointerEvents: 'none', zIndex: 14, boxShadow: '0 0 6px ' + cor }}
        />,
        <div
          key={'tag' + id}
          data-etq="humano" data-id={id}
          style={{ position: 'absolute', left: x, top: topo - 30, transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 17, display: 'flex', flexDirection: 'column', alignItems: 'center', whiteSpace: 'nowrap' }}
        >
          <div style={{ display: 'inline-block', background: cor, color: '#08090C', font: '700 10px ' + MONO, letterSpacing: '.1em', padding: '0 7px', lineHeight: '15px', borderRadius: 8 }}>
            {ceo ? 'CEO' : recep ? 'RECEPÇÃO' : 'VISITANTE'}
          </div>
          <div style={{ font: '700 13px ' + MONO, lineHeight: '17px', color: '#fff', textShadow: '1px 1px 0 #000, -1px 1px 0 #000' }}>{ch.humanName}</div>
        </div>,
      );
    } else if (registry.agent(id)) {
      // sigla do cargo com o ponto de estado: verde livre, amarelo aguardando, vermelho ocupado
      const st = ch.factoryStatus ?? 'free';
      const corSt = st === 'busy' ? '#EB5757' : st === 'waiting' ? '#F2C94C' : '#6FCF97';
      const sentado = ch.state === CharacterState.TYPE ? CHARACTER_SITTING_OFFSET_PX : 0;
      pilulas.push({ id, x, sigla: roleSigla(registry.agent(id)!.role, registry.agent(id)!.game), corSt, sentado, chy: ch.y, tc: ch.tileCol, tr: ch.tileRow });
      sprites.push({ id, l: x - 8 * esc, t: project.toScreenY(ch.y + sentado - 26), w: 16 * esc, h: pes - project.toScreenY(ch.y + sentado - 26) });
      const fb = ch.factoryBubble;
      if (fb) {
        const bw = larguraTexto(MONO_B, fb.texto) + 14;
        baloes.push({ id, x, base: project.toScreenY(ch.y + sentado - 34) - (ph - 2) - 24, w: bw, h: 22, pe: ch.y, wCurto: larguraTexto(MONO_B, 'Aguardando…') + 14, limite: limiteSala(ch.tileCol, ch.tileRow), texto: fb.texto, cor: corSt });
      }
    }
  }

  if (TESTE) {
    const w = window as unknown as { __factorySprites?: unknown; __factoryFixas?: unknown };
    w.__factorySprites = sprites;
    w.__factoryFixas = fixas;
  }
  // etiquetas dos agentes: baloes e pilulas, desviados na vertical para nao cobrir ninguem; em pilha muito alta (ou sobre a parede) a pilula vira so a bolinha de status
  {
    const agora = Date.now();
    const porId = new Map<number, ItemPilula>();
    const itens: ItemPilula[] = [];
    for (const p of pilulas) {
      const w = larguraTexto(MONO_FONTE(pf), p.sigla, pf * 0.08) + 3 + 7 + 3 + 4 + 2 + 2;
      const it: ItemPilula = {
        id: p.id,
        x: p.x,
        base: project.toScreenY(p.chy + p.sentado - 34) - (ph - 2),
        w,
        h: ph,
        pe: p.chy,
        limite: limiteSala(p.tc, p.tr),
      };
      itens.push(it);
      porId.set(p.id, it);
    }
    // histerese do degrau: ao descer, mantem o degrau anterior por 300 ms (agente andando nao faz a pilula pular)
    const retidos = new Map<number, number>();
    for (const [id, m] of degrausRef.current) retidos.set(id, m.k);
    const lay = posicionar(itens, baloes, fixas, sprites, passo, zoom < 0.6, retidos);
    const pos = lay.pilulas;
    const presentes = new Set<number>();
    const estados = new Map<number, { bolinha: boolean }>();
    const caixasPilula: Caixa[] = [];
    for (const p of pilulas) {
      presentes.add(p.id);
      const r = pos.get(p.id)!;
      const it = porId.get(p.id)!;
      let bolinha = r.colapsa;
      const mem = bolinhasRef.current;
      if (r.colapsa) mem.set(p.id, null);
      else if (mem.has(p.id)) {
        const desde = mem.get(p.id) ?? agora;
        mem.set(p.id, desde);
        if (agora - desde < 300) bolinha = true;
        else mem.delete(p.id);
      }
      if (!bolinha) {
        const d = degrausRef.current.get(p.id);
        if (!d || r.natural >= d.k) degrausRef.current.set(p.id, { k: r.natural, desde: null });
        else {
          const desde = d.desde ?? agora;
          degrausRef.current.set(p.id, agora - desde >= 300 ? { k: r.natural, desde: null } : { k: d.k, desde });
        }
      } else degrausRef.current.delete(p.id);
      estados.set(p.id, { bolinha });
      if (!bolinha) caixasPilula.push({ l: it.x - it.w / 2, t: r.top, w: it.w, h: ph });
    }
    for (const id of [...bolinhasRef.current.keys()]) if (!presentes.has(id)) bolinhasRef.current.delete(id);
    for (const id of [...degrausRef.current.keys()]) if (!presentes.has(id)) degrausRef.current.delete(id);
    const obstDots = fixas.concat(caixasPilula);
    const ocultos = new Map<number, string>();
    for (const b of baloes) {
      const pb = lay.baloes.get(b.id)!;
      if (pb.oculto) {
        ocultos.set(b.id, b.texto);
        continue;
      }
      nodes.push(
        <div
          key={'bal' + b.id}
          data-etq="balao"
          data-id={b.id}
          style={{ position: 'absolute', left: pb.cx, top: pb.t, width: pb.w, height: b.h, boxSizing: 'border-box', transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 16, whiteSpace: 'nowrap', textAlign: 'center', padding: '0 6px', lineHeight: '20px', background: '#0F1318', color: '#EEF1F6', border: '1px solid ' + b.cor, font: MONO_B, borderRadius: 6 }}
        >
          {pb.curto ? 'Aguardando…' : b.texto}
        </div>,
      );
      obstDots.push({ l: pb.cx - pb.w / 2, t: pb.t, w: pb.w, h: b.h });
    }
    const pilulaNo = (p: (typeof pilulas)[number], top: number, z: number, chave: string) => {
      const oculto = ocultos.has(p.id);
      const sobre = oculto && sobreId === p.id;
      return (
        <div
          key={chave + p.id}
          data-etq="pilula"
          data-id={p.id}
          onMouseEnter={oculto && chave === 'ia' ? () => setSobreId(p.id) : undefined}
          onMouseLeave={oculto && chave === 'ia' ? () => setSobreId((v) => (v === p.id ? null : v)) : undefined}
          style={{ position: 'absolute', left: p.x, top, height: ph, boxSizing: 'border-box', transform: 'translateX(-50%)', pointerEvents: oculto && chave === 'ia' ? 'auto' : 'none', zIndex: sobre ? 18 : z, display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap', background: '#0F1318', color: '#7AD1E0', border: '1px solid #7AD1E0', font: '700 ' + pf + 'px ' + MONO, letterSpacing: '.08em', padding: '0 4px 0 3px', borderRadius: 6 }}
        >
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.corSt, boxShadow: '0 0 4px ' + p.corSt }} />
          {p.sigla}
          {oculto && (chave === 'ih' || sobre) ? ' · ' + ocultos.get(p.id) : ''}
        </div>
      );
    };
    const donoTopo = new Map<number, number>();
    for (const p of pilulas) {
      const it = porId.get(p.id)!;
      const r = pos.get(p.id)!;
      if (!estados.get(p.id)!.bolinha) {
        nodes.push(pilulaNo(p, r.top, 14, 'ia'));
        donoTopo.set(p.id, r.top);
        const desloc = it.base - r.top;
        if (desloc > 6)
          nodes.push(<div key={'li' + p.id} data-etq="guia" data-id={p.id} style={{ position: 'absolute', left: p.x, top: r.top + ph, width: 1, height: desloc, background: '#7AD1E0', opacity: 0.6, pointerEvents: 'none', zIndex: 13 }} />);
        continue;
      }
      let dotTop = Math.max(it.base + ph - 10, it.limite ? it.limite.t : -1e9);
      for (let n = 0; n < 4 && obstDots.some((c) => dotTop - 2 < c.t + c.h && c.t < dotTop + 12 && p.x - 7 < c.l + c.w && c.l < p.x + 7); n++) dotTop += 11;
      obstDots.push({ l: p.x - 5, t: dotTop, w: 10, h: 10 });
      donoTopo.set(p.id, dotTop);
      // a bolinha fica sempre montada (mesma key); o hover so a liga, e a pilula completa e um no extra sem eventos, logo acima dela
      nodes.push(
        <div
          key={'dot' + p.id}
          data-etq="bolinha"
          data-id={p.id}
          onMouseEnter={() => setSobreId(p.id)}
          onMouseLeave={() => setSobreId((v) => (v === p.id ? null : v))}
          style={{ position: 'absolute', left: p.x - 5, top: dotTop, width: 10, height: 10, boxSizing: 'border-box', border: '1px solid #7AD1E0', background: '#0F1318', borderRadius: '50%', pointerEvents: 'auto', zIndex: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.corSt }} />
        </div>,
      );
      if (sobreId === p.id || officeState.selectedAgentId === p.id) nodes.push(pilulaNo(p, dotTop - ph, 18, 'ih'));
    }
    // linha-guia do balao ate o dono quando o balao esta longe (mais de 6 px de vao) ou deslocado para o lado
    for (const b of baloes) {
      const pb = lay.baloes.get(b.id)!;
      const topoDono = donoTopo.get(b.id);
      if (pb.oculto || topoDono === undefined) continue;
      const vao = topoDono - (pb.t + b.h);
      const lado = Math.abs(pb.cx - b.x) > 1;
      if (vao <= 6 && !lado) continue;
      const cor = '#7AD1E0';
      const estilo = { position: 'absolute' as const, background: cor, opacity: 0.6, pointerEvents: 'none' as const, zIndex: 13 };
      const fora = Math.abs(b.x - pb.cx) > pb.w / 2;
      if (fora) {
        const x0 = Math.min(b.x, pb.cx + (b.x < pb.cx ? -pb.w / 2 : pb.w / 2));
        nodes.push(<div key={'gh' + b.id} data-etq="guia" data-id={b.id} style={{ ...estilo, left: x0, top: pb.t + b.h / 2, width: Math.abs(b.x - (pb.cx + (b.x < pb.cx ? -pb.w / 2 : pb.w / 2))), height: 1 }} />);
      }
      const ini = fora ? pb.t + b.h / 2 : pb.t + b.h;
      if (topoDono - ini > 0) nodes.push(<div key={'gv' + b.id} data-etq="guia" data-id={b.id} style={{ ...estilo, left: b.x, top: ini, width: 1, height: topoDono - ini }} />);
    }
  }

  // Bia: clicar nela abre o recado (visitante) ou a caixa de entrada (CEO); o balao confirma ou avisa dos recados novos
  const bia = officeState.characters.get(BIA_ID);
  if (bia) {
    const bx = project.toScreenX(bia.x);
    const sentado = bia.state === CharacterState.TYPE ? CHARACTER_SITTING_OFFSET_PX : 0;
    const bTopo = project.toScreenY(bia.y + sentado - TOOL_OVERLAY_VERTICAL_OFFSET);
    const larg = (16 * zoom) / dpr;
    const fala = biaFala || (isOwner() ? (naoLidos ? (naoLidos === 1 ? '1 recado novo para você' : naoLidos + ' recados novos para você') : '') : 'Deixe seu recado comigo 💬');
    nodes.push(
      <div
        key="bia-hot"
        title="Falar com a Bia"
        onClick={() => window.dispatchEvent(new CustomEvent('factory-recepcao'))}
        style={{ position: 'absolute', left: bx - larg / 2, top: bTopo + 4, width: larg, height: larg * 2, cursor: 'pointer', pointerEvents: 'auto', zIndex: 15 }}
      />,
    );
    if (fala)
      nodes.push(
        <div
          key="bia-fala"
          style={{ position: 'absolute', left: bx, top: bTopo - 56, transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 17, whiteSpace: 'nowrap', background: '#0F1318', color: '#EEF1F6', border: '1px solid #F29BC4', font: '700 11px ' + MONO, padding: '3px 8px', borderRadius: 6 }}
        >
          {fala}
        </div>,
      );
  }

  // quadros de parede clicaveis: kanban em cada sala de squad e indicadores da fabrica na sala de reuniao (mesma posicao, 3x2 tiles)
  for (const r of ROOMS) {
    if (r.type !== 'team' && r.type !== 'meeting') continue;
    const kanban = r.type === 'team';
    const larg = (3 * 16 * zoom) / dpr;
    nodes.push(
      <div
        key={'quadro' + r.id}
        title={kanban ? 'Board do projeto' : 'Indicadores da fábrica'}
        onClick={() => setPainel(kanban ? { tipo: 'kanban', game: r.id } : { tipo: 'ind' })}
        onMouseEnter={() => setSobre(r.id)}
        onMouseLeave={() => setSobre('')}
        style={{ position: 'absolute', left: project.toScreenX((r.x + 3) * 16), top: project.toScreenY((r.y - 2) * 16), width: larg, height: (larg * 2) / 3, cursor: 'pointer', pointerEvents: 'auto', zIndex: 15, border: sobre === r.id ? '2px solid #FFC95C' : '2px solid transparent', boxShadow: sobre === r.id ? '0 0 8px #FFC95C' : 'none', boxSizing: 'border-box' }}
      />,
    );
  }

  const trocarAvatar = () => {
    void sb.auth.getSession().then(({ data }) => {
      if (!data.session) return sair();
      try {
        sessionStorage.setItem('factory-trocar', '1');
      } catch {
        /* sem armazenamento */
      }
      location.reload();
    });
  };
  const botao = { background: '#0F1318', color: '#EEF1F6', border: '1px solid #262E3A', font: '11px ' + MONO, padding: '4px 8px', cursor: 'pointer' } as const;

  if (TESTE) {
    const w = window as unknown as { __factoryMs?: number; __factoryN?: number };
    w.__factoryMs = (w.__factoryMs ?? 0) + performance.now() - t0;
    w.__factoryN = (w.__factoryN ?? 0) + 1;
  }
  return (
    <>
      {nodes}
      {painel?.tipo === 'kanban' && <KanbanSquad game={painel.game} onClose={() => setPainel(null)} />}
      {painel?.tipo === 'ind' && <IndicadoresFabrica officeState={officeState} onClose={() => setPainel(null)} />}
      <div style={{ position: 'fixed', left: 16, top: 84, zIndex: 25, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
        <div style={{ font: '700 11px ' + MONO, color: isOwner() ? '#FFC95C' : '#6FCF97', letterSpacing: '.08em' }}>{me.name}</div>
        <button style={botao} onClick={trocarAvatar}>Trocar avatar/nome</button>
        <button style={{ ...botao, ...(mic ? { borderColor: '#6FCF97', color: '#6FCF97' } : {}) }} onClick={() => alternarMic.current()}>
          {mic ? 'Microfone: ligado' : 'Ligar microfone'}
        </button>
        {micMsg && <div style={{ font: '10px ' + MONO, color: '#A9B3C4', maxWidth: 170 }}>{micMsg}</div>}
        <Recados />
        {isOwner() && (
          <Reuniao
            game={reuniao}
            onChange={(g) => {
              reuniaoRef.current = g;
              setReuniao(g);
            }}
          />
        )}
        <button style={botao} onClick={sair}>Sair</button>
      </div>
      <div style={{ position: 'fixed', left: 16, bottom: 96, zIndex: 25, display: 'flex', gap: 16, font: '14px ' + MONO, color: '#EEF1F6', background: 'rgba(8,9,12,.92)', border: '1px solid #262E3A', padding: '8px 14px' }}>
        <span><b style={{ color: '#7AD1E0', border: '1px solid #7AD1E0', padding: '0 6px', borderRadius: 6 }}>IA</b> agente</span>
        <span><b style={{ background: '#FFC95C', color: '#08090C', padding: '1px 8px', borderRadius: 8 }}>HUMANO</b> pessoa (anel no chão)</span>
        <span><i style={{ color: '#6FCF97' }}>●</i> livre <i style={{ color: '#F2C94C' }}>●</i> aguardando <i style={{ color: '#EB5757' }}>●</i> ocupado</span>
        <span><i style={{ color: '#6FCF97' }}>●</i> {[...officeState.characters.values()].filter((c) => c.isHuman && c.humanKind !== 'recep' && (c.remote || c.id === MY_ID)).length} online</span>
        <span>clique ou WASD para andar</span>
      </div>
      {perto && (
        <div style={{ position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', zIndex: 25, minWidth: 280, background: '#0F1318', border: '1px solid #7AD1E0', padding: '8px 14px', font: '13px ' + MONO, color: '#EEF1F6' }}>
          <div style={{ color: '#7AD1E0', fontSize: 10, letterSpacing: '.14em' }}>AGENTE POR PERTO · {perto.squad}</div>
          <div style={{ fontWeight: 700, color: '#FFC95C' }}>{perto.nome} ({perto.papel})</div>
          <div style={{ color: '#A9B3C4' }}>{perto.atividade}</div>
        </div>
      )}
    </>
  );
}
