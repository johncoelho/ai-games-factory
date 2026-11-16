import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

import { AVISO_PRIVADO, type Issue, type IssueAgora, type Resultado, issueAgora, issuesDoPapel, temPrivado } from './issues.js';
import { registry } from './registry.js';
import { roleFromLabel } from './roles.js';
import { isOwner } from './session.js';

const mono = "ui-monospace,Consolas,'JetBrains Mono',monospace";
const CINZA = '#5C6678';
const AMBAR = '#E6AC3F';

const Titulo = ({ children }: { children: React.ReactNode }) => (
  <div data-testid="issues-secao" style={{ color: '#FFC95C', letterSpacing: '.08em', fontSize: 11, margin: '6px 0 2px' }}>{children}</div>
);

function Linha({ i, sufixo }: { i: Issue; sufixo?: string }) {
  return (
    <a
      href={i.url}
      target="_blank"
      rel="noreferrer"
      style={{ display: 'block', color: '#EEF1F6', textDecoration: 'none', padding: '5px 0', borderTop: '1px solid #262E3A', overflowWrap: 'anywhere' }}
    >
      {i.numero > 0 && <span style={{ color: '#7AD1E0' }}>#{i.numero} </span>}{i.titulo}
      <span style={{ display: 'block', color: CINZA, fontSize: 11 }}>{sufixo ?? i.etapa}</span>
    </a>
  );
}

// Painel do agente selecionado, em camadas: AGORA (issue ativa do evento) -> "Na sua etapa" (filtro do quadro) -> sem issue.
// "Nenhuma issue em X" so aparece com o agente parado: nunca diz isso de quem esta trabalhando.
export function FactoryIssues({ game, label, id }: { game?: string; label?: string; id?: number }) {
  const [res, setRes] = useState<Resultado | null>(null);
  const [agora, setAgora] = useState<IssueAgora | null>(null);
  useSyncExternalStore(registry.subscribe, registry.version); // issue e atividade vivem no registry
  const role = label ? roleFromLabel(/\(([^)]+)\)\s*$/.exec(label)?.[1] ?? label, game) : '';
  const ref = id !== undefined ? registry.issue(id) : undefined;

  useEffect(() => {
    if (!game || !role || !isOwner()) return;
    let vivo = true;
    setRes(null);
    const carregar = () => void issuesDoPapel(game, role).then((r) => vivo && setRes(r));
    carregar();
    const t = setInterval(carregar, 30_000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [game, role]);

  // titulo da issue ativa: sai do cache do quadro (30 s); troca de issue refaz
  useEffect(() => {
    setAgora(null);
    if (!game || !ref || !isOwner()) return;
    let vivo = true;
    const carregar = () => void issueAgora(game, ref).then((r) => vivo && setAgora(r));
    carregar();
    const t = setInterval(carregar, 30_000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [game, ref]);

  if (!game || !role || !isOwner()) return null;

  const rodada = id !== undefined && registry.rodada(id);
  const atividade = id !== undefined ? registry.activity(id) : '';
  const ativo = rodada || (atividade !== '' && atividade !== 'descansando');

  const estreito = window.innerWidth < 700;
  const partes: React.ReactNode[] = [];

  // 1) AGORA: a issue do evento
  if (ref) {
    const [repoRef, num] = ref.split('#');
    const txt = agora?.titulo ?? (agora?.noQuadro === false ? '(fora do quadro)' : '');
    const corpo = (
      <>
        <span style={{ color: '#FFC95C', letterSpacing: '.08em', fontSize: 11 }}>AGORA: </span>
        <span style={{ color: '#7AD1E0' }}>#{num} </span>
        {txt}
        <span style={{ display: 'block', color: CINZA, fontSize: 11 }}>{repoRef}</span>
      </>
    );
    const estilo = { display: 'block', color: '#EEF1F6', textDecoration: 'none', padding: '5px 0', overflowWrap: 'anywhere' } as const;
    partes.push(
      <div key="agora" data-testid="issues-agora">
        {agora ? <a href={agora.url} target="_blank" rel="noreferrer" style={estilo}>{corpo}</a> : <div style={estilo}>{corpo}</div>}
      </div>,
    );
  } else if (ativo) {
    // ativo sem issue: nao e "nenhuma issue", e trabalho sem cartao (conversa, triagem, agente avulso)
    partes.push(
      <div key="semissue" data-testid="issues-semissue" style={{ color: '#EEF1F6', padding: '4px 0', overflowWrap: 'anywhere' }}>
        {rodada ? 'Em rodada de triagem' : <>Trabalhando sem issue no quadro, agora: {atividade}</>}
      </div>,
    );
  }

  // 2) Na sua etapa (filtro do quadro pelas etapas do papel)
  // compara a URL do cartao com owner/repo#N da issue ativa (numero igual em outro repo nao conta); '#' so no demo
  const alvoUrl = ref ? `/${ref.split('#')[0]}/issues/${ref.split('#')[1]}`.toLowerCase() : '';
  const jaMostrada = (i: Issue) =>
    !!ref && agora?.noQuadro === true && (i.url.toLowerCase().endsWith(alvoUrl) || (i.url === '#' && i.numero === agora.numero));
  let etapa: React.ReactNode = null;
  if (!res) etapa = <div style={{ color: CINZA }}>carregando…</div>;
  else if (res.estado === 'sem_token') etapa = <div style={{ color: AMBAR }}>Quadro ainda não liberado: falta o token do GitHub no Supabase.</div>;
  else if (res.estado === 'erro') etapa = <div style={{ color: AMBAR }}>Não foi possível ler o quadro ({res.msg}).</div>;
  else {
    const itens = res.itens.filter((i) => !jaMostrada(i));
    if (itens.length > 0)
      etapa = (
        <>
          {temPrivado(itens) && <div style={{ color: CINZA, fontSize: 11, marginBottom: 6 }}>{AVISO_PRIVADO}</div>}
          {itens.map((i, k) => <Linha key={i.url + i.numero + k} i={i} />)}
        </>
      );
    else if (!ativo) {
      etapa = res.etapas.length === 0
        ? <div style={{ color: CINZA }}>Esse papel não atua em etapas do quadro.</div>
        : <div style={{ color: CINZA }}>Nenhuma issue em {res.etapas.join(' / ')}.</div>;
    }
  }
  if (etapa) {
    const comLista = res?.estado === 'ok' && res.itens.some((i) => !jaMostrada(i));
    partes.push(
      <div key="etapa" data-testid="issues-etapa">
        {comLista && <Titulo>Na sua etapa: {res.estado === 'ok' ? res.etapas.join(' / ') : ''}</Titulo>}
        {etapa}
      </div>,
    );
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        // celular: abaixo do radio e ao lado dos botoes do John (sem cobrir nenhum dos dois); desktop: como antes
        ...(estreito
          ? { left: 150, top: 146, width: 'calc(100vw - 158px)', maxHeight: 'min(170px, calc(100vh - 290px))' }
          : { left: 200, top: 84, width: 'min(300px, calc(100vw - 216px))', maxHeight: 'calc(100vh - 260px)' }),
        overflow: 'auto',
        zIndex: 20,
        background: '#0F1318',
        border: '1px solid #E6AC3F',
        padding: 12,
        font: `13px ${mono}`,
        color: '#A9B3C4',
      }}
    >
      <div style={{ color: '#FFC95C', letterSpacing: '.12em', fontSize: 11, marginBottom: 8 }}>
        ISSUES · {label?.toUpperCase()}
      </div>
      {partes}
    </div>,
    document.body,
  );
}
