import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { type Resultado, issuesDoPapel } from './issues.js';
import { roleFromLabel } from './roles.js';
import { isOwner } from './session.js';

// Painel de issues do agente selecionado. O papel vem do rotulo "Apelido (papel)" definido pelo transporte.
export function FactoryIssues({ game, label }: { game?: string; label?: string }) {
  const [res, setRes] = useState<Resultado | null>(null);
  const role = label ? roleFromLabel(/\(([^)]+)\)\s*$/.exec(label)?.[1] ?? label, game) : '';

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

  if (!game || !role || !isOwner()) return null;

  const mono = "ui-monospace,Consolas,'JetBrains Mono',monospace";
  let corpo: React.ReactNode;
  if (!res) corpo = <div style={{ color: '#5C6678' }}>carregando…</div>;
  else if (res.estado === 'sem_token')
    corpo = <div style={{ color: '#E6AC3F' }}>Quadro ainda não liberado: falta o token do GitHub no Supabase.</div>;
  else if (res.estado === 'erro') corpo = <div style={{ color: '#E6AC3F' }}>Não foi possível ler o quadro ({res.msg}).</div>;
  else if (res.etapas.length === 0) corpo = <div style={{ color: '#5C6678' }}>Esse papel não atua em etapas do quadro.</div>;
  else if (res.itens.length === 0) corpo = <div style={{ color: '#5C6678' }}>Nenhuma issue em {res.etapas.join(' / ')}.</div>;
  else
    corpo = (
      <>
        {res.itens.map((i) => (
          <a
            key={i.numero}
            href={i.url}
            target="_blank"
            rel="noreferrer"
            style={{ display: 'block', color: '#EEF1F6', textDecoration: 'none', padding: '5px 0', borderTop: '1px solid #262E3A' }}
          >
            <span style={{ color: '#7AD1E0' }}>#{i.numero}</span> {i.titulo}
            <span style={{ display: 'block', color: '#5C6678', fontSize: 11 }}>{i.etapa}</span>
          </a>
        ))}
      </>
    );

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: 200,
        top: 84,
        width: 'min(300px, calc(100vw - 216px))',
        maxHeight: 'calc(100vh - 260px)',
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
      {corpo}
    </div>,
    document.body,
  );
}
