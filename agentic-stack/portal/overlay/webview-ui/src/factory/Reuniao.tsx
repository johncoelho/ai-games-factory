import { useEffect, useState } from 'react';

import { SQUADS } from './config.js';
import { type Issue, type Resultado, statusDoSquad } from './issues.js';
import { getMeta } from './meta.js';

const MONO = "ui-monospace,Consolas,'JetBrains Mono',monospace";
const ENTREGUE = /publicad|conclu|feito|done|entregue|lancad/i;

// Sala de reuniao (so o CEO): chama o time inteiro de um produto para a sala e mostra o status das entregas do quadro dele.
export function Reuniao({ game, onChange }: { game: string | null; onChange: (g: string | null) => void }) {
  const [aberto, setAberto] = useState(false);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [res, setRes] = useState<Resultado | null>(null);

  useEffect(() => {
    for (const s of SQUADS) void getMeta(s.slug).then((m) => setNomes((n) => ({ ...n, [s.slug]: m.squad || s.slug })));
  }, []);

  useEffect(() => {
    if (!game) return;
    let vivo = true;
    setRes(null);
    const carregar = () => void statusDoSquad(game).then((r) => vivo && setRes(r));
    carregar();
    const t = setInterval(carregar, 30_000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [game]);

  const botao = { background: '#0F1318', color: '#EEF1F6', border: '1px solid #262E3A', font: '11px ' + MONO, padding: '4px 8px', cursor: 'pointer', textAlign: 'left' } as const;

  const lista = (itens: Issue[]) =>
    itens.map((i) => (
      <a key={i.numero} href={i.url} target="_blank" rel="noreferrer" style={{ display: 'block', color: '#EEF1F6', textDecoration: 'none', padding: '4px 0', borderTop: '1px solid #262E3A' }}>
        <span style={{ color: '#7AD1E0' }}>#{i.numero}</span> {i.titulo}
        <span style={{ display: 'block', color: '#5C6678', fontSize: 11 }}>{i.etapa}</span>
      </a>
    ));

  let corpo: React.ReactNode = <div style={{ color: '#5C6678' }}>carregando o quadro…</div>;
  if (res?.estado === 'sem_token') corpo = <div style={{ color: '#E6AC3F' }}>Quadro ainda não liberado: falta o token do GitHub no Supabase.</div>;
  else if (res?.estado === 'erro') corpo = <div style={{ color: '#E6AC3F' }}>Não foi possível ler o quadro ({res.msg}).</div>;
  else if (res?.estado === 'ok') {
    const entregues = res.itens.filter((i) => ENTREGUE.test(i.etapa));
    const emCurso = res.itens.filter((i) => !ENTREGUE.test(i.etapa));
    corpo = (
      <>
        <div style={{ color: '#6FCF97', letterSpacing: '.1em', fontSize: 11, margin: '4px 0' }}>ENTREGUES ({entregues.length})</div>
        {entregues.length ? lista(entregues) : <div style={{ color: '#5C6678' }}>nada entregue ainda</div>}
        <div style={{ color: '#FFC95C', letterSpacing: '.1em', fontSize: 11, margin: '10px 0 4px' }}>EM CURSO ({emCurso.length})</div>
        {emCurso.length ? lista(emCurso) : <div style={{ color: '#5C6678' }}>nada em curso</div>}
      </>
    );
  }

  return (
    <>
      <button style={botao} onClick={() => (game ? onChange(null) : setAberto((v) => !v))}>
        {game ? 'Encerrar reunião' : 'Chamar reunião'}
      </button>
      {aberto && !game && (
        <div style={{ display: 'grid', gap: 3 }}>
          {SQUADS.map((s) => (
            <button
              key={s.slug}
              style={botao}
              onClick={() => {
                setAberto(false);
                onChange(s.slug);
              }}
            >
              {nomes[s.slug] ?? s.slug}
            </button>
          ))}
        </div>
      )}
      {game && (
        <div style={{ position: 'fixed', left: 200, top: 84, width: 340, maxHeight: '60vh', overflow: 'auto', zIndex: 26, background: '#0F1318', border: '1px solid #E6AC3F', padding: 12, font: '13px ' + MONO, color: '#A9B3C4' }}>
          <div style={{ color: '#FFC95C', letterSpacing: '.12em', fontSize: 11 }}>REUNIÃO · {(nomes[game] ?? game).toUpperCase()}</div>
          <div style={{ fontSize: 11, color: '#5C6678', marginBottom: 6 }}>o time foi chamado para a sala de reunião; status do quadro abaixo</div>
          {corpo}
        </div>
      )}
    </>
  );
}
