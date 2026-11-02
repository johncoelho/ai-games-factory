import { useEffect, useState } from 'react';

import type { OfficeState } from '../office/engine/officeState.js';
import { SQUADS } from './config.js';
import { type Issue, type Resultado, statusDoSquad } from './issues.js';
import { getMeta } from './meta.js';
import { registry } from './registry.js';
import { isOwner } from './session.js';
import { sb } from './supabase.js';

const MONO = "ui-monospace,Consolas,'JetBrains Mono',monospace";
const ENTREGUE = /publicad|conclu|feito|done|entregue|lancad/i;

const moldura = {
  position: 'fixed',
  left: '50%',
  top: 84,
  transform: 'translateX(-50%)',
  width: 'min(960px, calc(100vw - 32px))',
  maxHeight: 'calc(100vh - 200px)',
  overflow: 'auto',
  zIndex: 45,
  background: '#0F1318',
  border: '1px solid #E6AC3F',
  padding: 14,
  font: '13px ' + MONO,
  color: '#A9B3C4',
} as const;

function Cabecalho({ titulo, sub, onClose }: { titulo: string; sub?: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
      <div style={{ color: '#FFC95C', letterSpacing: '.14em', fontSize: 12, fontWeight: 700 }}>{titulo}</div>
      {sub && <div style={{ color: '#5C6678', fontSize: 11, flex: 1 }}>{sub}</div>}
      <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: '1px solid #262E3A', color: '#EEF1F6', font: '11px ' + MONO, padding: '2px 8px', cursor: 'pointer' }}>
        fechar
      </button>
    </div>
  );
}

// Kanban do squad: o backlog completo do quadro da esteira (o dono dos cartoes), uma coluna por etapa.
export function KanbanSquad({ game, onClose }: { game: string; onClose: () => void }) {
  const [res, setRes] = useState<Resultado | null>(null);
  const [ordem, setOrdem] = useState<string[]>([]);
  const [nome, setNome] = useState(game);

  useEffect(() => {
    let vivo = true;
    void getMeta(game).then((m) => {
      if (!vivo) return;
      setNome(m.squad || game);
      setOrdem(Object.values(m.etapas).reduce<string[]>((acc, l) => [...acc, ...l.filter((e) => !acc.includes(e))], []));
    });
    const carregar = () => void statusDoSquad(game).then((r) => vivo && setRes(r));
    if (isOwner()) {
      carregar();
      const t = setInterval(carregar, 30_000);
      return () => {
        vivo = false;
        clearInterval(t);
      };
    }
    return () => {
      vivo = false;
    };
  }, [game]);

  let corpo: React.ReactNode;
  if (!isOwner()) corpo = <div style={{ color: '#E6AC3F' }}>O quadro do projeto é restrito ao CEO.</div>;
  else if (!res) corpo = <div style={{ color: '#5C6678' }}>carregando o quadro…</div>;
  else if (res.estado === 'sem_token') corpo = <div style={{ color: '#E6AC3F' }}>Quadro ainda não liberado: falta o token do GitHub no Supabase.</div>;
  else if (res.estado === 'erro') corpo = <div style={{ color: '#E6AC3F' }}>Não foi possível ler o quadro ({res.msg}).</div>;
  else {
    const colunas = [...ordem];
    for (const i of res.itens) if (!colunas.includes(i.etapa)) colunas.push(i.etapa);
    corpo = (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8, alignItems: 'start' }}>
        {colunas.map((c) => {
          const cards = res.itens.filter((i: Issue) => i.etapa === c);
          const cor = ENTREGUE.test(c) ? '#6FCF97' : /andamento/i.test(c) ? '#FFC95C' : '#7AD1E0';
          return (
            <div key={c} style={{ background: '#0B0E13', border: '1px solid #262E3A', padding: 8 }}>
              <div style={{ color: cor, fontSize: 11, letterSpacing: '.1em', marginBottom: 6 }}>
                {(c || 'SEM ETAPA').toUpperCase()} · {cards.length}
              </div>
              {cards.length === 0 && <div style={{ color: '#3B4455', fontSize: 11 }}>vazio</div>}
              {cards.map((i) => (
                <a key={i.numero} href={i.url} target="_blank" rel="noreferrer" style={{ display: 'block', color: '#EEF1F6', textDecoration: 'none', background: '#141A22', borderLeft: '3px solid ' + cor, padding: '5px 7px', marginBottom: 5, fontSize: 12 }}>
                  <span style={{ color: '#7AD1E0' }}>#{i.numero}</span> {i.titulo}
                </a>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={moldura}>
      <Cabecalho titulo={'BOARD · ' + nome.toUpperCase()} sub="backlog completo do quadro do projeto (cartões abertos)" onClose={onClose} />
      {corpo}
    </div>
  );
}

interface Evento {
  ts: string;
  game: string;
  agent: string;
}

const numero = (n: number) => n.toLocaleString('pt-BR');

// Indicadores consolidados da fabrica: todos os squads (esteiras) juntos. Eventos dos hooks (ultimas 24 h), estado ao vivo dos agentes e, para o CEO, o quadro.
export function IndicadoresFabrica({ officeState, onClose }: { officeState: OfficeState; onClose: () => void }) {
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [quadros, setQuadros] = useState<Record<string, Resultado>>({});
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [, setTick] = useState(0);

  useEffect(() => {
    let vivo = true;
    for (const s of SQUADS) void getMeta(s.slug).then((m) => vivo && setNomes((n) => ({ ...n, [s.slug]: m.squad || s.slug })));
    const carregar = () => {
      void sb
        .from('factory_events_public')
        .select('ts,game,agent')
        .order('ts', { ascending: false })
        .limit(5000)
        .then(({ data }) => vivo && setEventos((data ?? []) as Evento[]));
      if (isOwner()) for (const s of SQUADS) void statusDoSquad(s.slug).then((r) => vivo && setQuadros((q) => ({ ...q, [s.slug]: r })));
      setTick((n) => n + 1);
    };
    carregar();
    const t = setInterval(carregar, 30_000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, []);

  const agora = Date.now();
  const porSquad = SQUADS.map((s) => {
    let livres = 0, aguardando = 0, ocupados = 0, ferias = 0;
    for (const id of registry.agentIds()) {
      const info = registry.agent(id);
      const ch = officeState.characters.get(id);
      if (!info || info.game !== s.slug || !ch) continue;
      if (ch.ferias) ferias++;
      const st = ch.factoryStatus ?? 'free';
      if (st === 'busy') ocupados++;
      else if (st === 'waiting') aguardando++;
      else livres++;
    }
    const ev = (eventos ?? []).filter((e) => e.game === s.slug);
    const q = quadros[s.slug];
    const itens = q?.estado === 'ok' ? q.itens : null;
    return {
      slug: s.slug,
      nome: nomes[s.slug] ?? s.slug,
      livres, aguardando, ocupados, ferias,
      eventos: ev.length,
      ultima: ev.length ? Math.max(...ev.map((e) => Date.parse(e.ts))) : 0,
      agentesAtivos: new Set(ev.filter((e) => agora - Date.parse(e.ts) < 3_600_000).map((e) => e.agent)).size,
      abertas: itens ? itens.length : null,
      emCurso: itens ? itens.filter((i) => /andamento/i.test(i.etapa)).length : null,
      entregues: itens ? itens.filter((i) => ENTREGUE.test(i.etapa)).length : null,
      fila: itens ? itens.filter((i) => !ENTREGUE.test(i.etapa) && !/andamento/i.test(i.etapa)).length : null,
    };
  });
  const soma = (f: (x: (typeof porSquad)[number]) => number) => porSquad.reduce((a, x) => a + f(x), 0);
  const quadroOk = porSquad.some((x) => x.abertas !== null);

  // atividade por hora nas ultimas 24 h (todos os squads)
  const horas = Array.from({ length: 24 }, () => 0);
  for (const e of eventos ?? []) {
    const h = Math.floor((agora - Date.parse(e.ts)) / 3_600_000);
    if (h >= 0 && h < 24) horas[23 - h]++;
  }
  const maxH = Math.max(1, ...horas);

  const kpi = (rot: string, val: string, cor = '#EEF1F6', nota?: string) => (
    <div style={{ background: '#0B0E13', border: '1px solid #262E3A', padding: '8px 10px', minWidth: 120, flex: '1 1 120px' }}>
      <div style={{ color: '#5C6678', fontSize: 10, letterSpacing: '.1em' }}>{rot}</div>
      <div style={{ color: cor, fontSize: 22, fontWeight: 700 }}>{val}</div>
      {nota && <div style={{ color: '#5C6678', fontSize: 10 }}>{nota}</div>}
    </div>
  );
  const dot = (c: string) => <i style={{ color: c, fontStyle: 'normal' }}>●</i>;
  const th = { textAlign: 'left', color: '#5C6678', fontSize: 10, letterSpacing: '.08em', fontWeight: 400, padding: '4px 6px' } as const;
  const td = { padding: '5px 6px', borderTop: '1px solid #262E3A' } as const;
  const quando = (t: number) => (!t ? '—' : agora - t < 60_000 ? 'agora' : agora - t < 3_600_000 ? Math.round((agora - t) / 60_000) + ' min' : Math.round((agora - t) / 3_600_000) + ' h');
  const sem = (v: number | null) => (v === null ? '—' : String(v));

  return (
    <div style={moldura}>
      <Cabecalho titulo="INDICADORES DA FÁBRICA" sub="todas as esteiras juntas · atualiza a cada 30 s" onClose={onClose} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {kpi('SQUADS', String(SQUADS.length))}
        {kpi('AGENTES', String(porSquad.reduce((a, x) => a + x.livres + x.aguardando + x.ocupados, 0)), '#7AD1E0')}
        {kpi('OCUPADOS AGORA', String(soma((x) => x.ocupados)), '#EB5757', soma((x) => x.aguardando) + ' aguardando')}
        {kpi('EVENTOS · 24 H', eventos ? numero(eventos.length) : '…', '#FFC95C', 'ações dos agentes')}
        {kpi('DE FÉRIAS', String(soma((x) => x.ferias)), '#7AD1E0', 'sem demanda há 1 semana')}
        {quadroOk && kpi('CARTÕES ABERTOS', String(soma((x) => x.abertas ?? 0)), '#6FCF97', soma((x) => x.emCurso ?? 0) + ' em andamento')}
      </div>
      <div style={{ color: '#5C6678', fontSize: 10, letterSpacing: '.1em', marginBottom: 4 }}>ATIVIDADE POR HORA · ÚLTIMAS 24 H</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 56, marginBottom: 14, borderBottom: '1px solid #262E3A' }}>
        {horas.map((n, k) => (
          <div key={k} title={n + ' eventos'} style={{ flex: 1, height: Math.max(2, (n / maxH) * 54), background: k === 23 ? '#FFC95C' : '#E6AC3F', opacity: n ? 1 : 0.25 }} />
        ))}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 640 }}>
          <thead>
            <tr>
              <th style={th}>SQUAD</th>
              <th style={th}>AGENTES</th>
              <th style={th}>EVENTOS 24 H</th>
              <th style={th}>ATIVOS 1 H</th>
              <th style={th}>ÚLTIMO EVENTO</th>
              <th style={th}>FILA</th>
              <th style={th}>EM ANDAMENTO</th>
              <th style={th}>ENTREGUES</th>
            </tr>
          </thead>
          <tbody>
            {porSquad.map((x) => (
              <tr key={x.slug} style={{ color: '#EEF1F6' }}>
                <td style={{ ...td, color: '#FFC95C' }}>{x.nome}</td>
                <td style={td}>
                  {dot('#6FCF97')} {x.livres} {dot('#F2C94C')} {x.aguardando} {dot('#EB5757')} {x.ocupados}
                </td>
                <td style={td}>{numero(x.eventos)}</td>
                <td style={td}>{x.agentesAtivos}</td>
                <td style={td}>{quando(x.ultima)}</td>
                <td style={td}>{sem(x.fila)}</td>
                <td style={td}>{sem(x.emCurso)}</td>
                <td style={td}>{sem(x.entregues)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!isOwner() ? (
        <div style={{ color: '#5C6678', fontSize: 11, marginTop: 8 }}>Fila, andamento e entregues vêm do quadro e aparecem só para o CEO.</div>
      ) : !quadroOk ? (
        <div style={{ color: '#E6AC3F', fontSize: 11, marginTop: 8 }}>Quadro ainda não liberado: falta o token do GitHub no Supabase (colunas com “—”).</div>
      ) : null}
    </div>
  );
}
