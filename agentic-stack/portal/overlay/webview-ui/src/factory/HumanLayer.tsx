import { useEffect, useRef, useState } from 'react';

import { CHARACTER_SITTING_OFFSET_PX, TOOL_OVERLAY_VERTICAL_OFFSET } from '../constants.js';
import type { OfficeState } from '../office/engine/officeState.js';
import { overlayProjection } from '../office/projection.js';
import { CharacterState } from '../office/types.js';
import { sair } from './gate.js';
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
    type P = { name: string; palette: number; kind: 'ceo' | 'visitor'; col: number; row: number; mic?: boolean; t?: number; meeting?: string | null };
    const meuKey = Math.random().toString(36).slice(2);
    const canal = sb.channel('factory-presence', { config: { presence: { key: meuKey } } });
    const remotos = new Map<string, number>();
    const ultimosP = new Map<string, P>();
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
        if (p.kind === 'ceo' && (isOwner() || k !== ceoKey)) continue;
        vistos.add(k);
        ultimosP.set(k, p);
        if (p.kind === 'ceo') ceoOnline = true;
        const cid = remotos.get(k);
        if (cid === undefined) {
          const novo = seq++;
          remotos.set(k, novo);
          officeState.addHuman(novo, p.palette, 0, seatAt(p.col, p.row), p.name, p.kind, p.col, p.row);
        } else {
          officeState.humanGoTo(cid, p.col, p.row);
        }
      }
      for (const [k, cid] of remotos) {
        if (vistos.has(k)) continue;
        officeState.removeAgent(cid);
        remotos.delete(k);
        ultimosP.delete(k);
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
    let t: ReturnType<typeof setInterval> | null = null;
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
      canal.on('presence', { event: 'sync' }, sync).subscribe((st) => {
        if (st !== 'SUBSCRIBED') return;
        sync();
        t = setInterval(() => {
          const eu = officeState.characters.get(MY_ID);
          if (!eu) return;
          officeState.factoryMeeting(isOwner() ? reuniaoRef.current : meetingRemoto);
          const chave = eu.tileCol + ',' + eu.tileRow + ',' + voz.ligado + ',' + reuniaoRef.current;
          if (chave === ultimo) return;
          ultimo = chave;
          void canal.track({ name: me.name, palette: me.palette, kind: isOwner() ? 'ceo' : 'visitor', col: eu.tileCol, row: eu.tileRow, mic: voz.ligado, t: Date.now(), meeting: isOwner() ? reuniaoRef.current : null });
        }, 600);
        // voz: quem esta a ate 4 tiles (e ainda ate 6 se ja conectado) e tambem esta com o microfone ligado
        v = setInterval(() => {
          const eu = officeState.characters.get(MY_ID);
          if (!eu || !voz.ligado) return;
          const conectados = new Set(voz.conectados());
          const alvo = new Map<string, number>();
          for (const [k, cid] of remotos) {
            const c = officeState.characters.get(cid);
            if (!c || !ultimosP.get(k)?.mic) continue;
            const d = Math.hypot(c.tileCol - eu.tileCol, c.tileRow - eu.tileRow);
            if (d <= (conectados.has(k) ? 6 : 4)) alvo.set(k, d);
          }
          voz.atualizar(alvo);
        }, 700);
      });
    }, 300);
    return () => {
      clearInterval(iniciar);
      if (t) clearInterval(t);
      if (v) clearInterval(v);
      voz.desligar();
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
        papel: roleLabel(info.role),
        squad: registry.squad(info.game) ?? info.game,
        atividade: registry.activity(melhor.id) || 'parado',
      });
    }, 350);
    return () => clearInterval(t);
  }, [officeState]);

  const el = containerRef.current;
  if (!el) return null;
  const dpr = window.devicePixelRatio || 1;
  const project = overlayProjection(officeState.getLayout(), el.getBoundingClientRect(), zoom, panRef.current, dpr);
  const nodes: React.ReactNode[] = [];

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
      nodes.push(
        <div
          key={'anel' + id}
          style={{ position: 'absolute', left: x - larg / 2, top: pes - larg * 0.28, width: larg, height: larg * 0.56, border: '2px solid ' + cor, borderRadius: '50%', pointerEvents: 'none', zIndex: 14, boxShadow: '0 0 6px ' + cor }}
        />,
        <div
          key={'tag' + id}
          style={{ position: 'absolute', left: x, top: topo - 30, transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 16, textAlign: 'center', whiteSpace: 'nowrap' }}
        >
          <div style={{ display: 'inline-block', background: cor, color: '#08090C', font: '700 10px ' + MONO, letterSpacing: '.1em', padding: '1px 7px', borderRadius: 8 }}>
            {ceo ? 'CEO' : recep ? 'RECEPÇÃO' : 'VISITANTE'}
          </div>
          <div style={{ font: '700 13px ' + MONO, color: '#fff', textShadow: '1px 1px 0 #000, -1px 1px 0 #000' }}>{ch.humanName}</div>
        </div>,
      );
    } else if (registry.agent(id)) {
      // sigla do cargo com o ponto de estado: verde livre, amarelo aguardando, vermelho ocupado
      const st = ch.factoryStatus ?? 'free';
      const corSt = st === 'busy' ? '#EB5757' : st === 'waiting' ? '#F2C94C' : '#6FCF97';
      const sentado = ch.state === CharacterState.TYPE ? CHARACTER_SITTING_OFFSET_PX : 0;
      nodes.push(
        <div
          key={'ia' + id}
          style={{ position: 'absolute', left: x, top: project.toScreenY(ch.y + sentado - 34) - 13, transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 14, display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap', background: '#0F1318', color: '#7AD1E0', border: '1px solid #7AD1E0', font: '700 9px ' + MONO, letterSpacing: '.08em', padding: '0 4px 0 3px', borderRadius: 6 }}
        >
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: corSt, boxShadow: '0 0 4px ' + corSt }} />
          {roleSigla(registry.agent(id)!.role)}
        </div>,
      );
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
        <span><b style={{ color: '#7AD1E0', border: '1px solid #7AD1E0', padding: '0 6px', borderRadius: 6 }}>PM</b> agente</span>
        <span><b style={{ background: '#FFC95C', color: '#08090C', padding: '1px 8px', borderRadius: 8 }}>CEO</b> pessoa (anel no chão)</span>
        <span><i style={{ color: '#6FCF97' }}>●</i> livre <i style={{ color: '#F2C94C' }}>●</i> aguardando <i style={{ color: '#EB5757' }}>●</i> ocupado</span>
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
