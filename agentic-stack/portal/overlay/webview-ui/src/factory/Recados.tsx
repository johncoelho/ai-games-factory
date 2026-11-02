import { useCallback, useEffect, useRef, useState } from 'react';

import { isOwner, me } from './session.js';
import { sb } from './supabase.js';

const MONO = "ui-monospace,Consolas,'JetBrains Mono',monospace";

interface Meu {
  id: string;
  body: string;
  created_at: string;
  reply: string | null;
  replied_at: string | null;
}
interface Caixa extends Meu {
  visitor_name: string;
  read_at: string | null;
}

function chaveVisitante(): string {
  try {
    let k = localStorage.getItem('factory-vkey');
    if (!k) {
      k = crypto.randomUUID();
      localStorage.setItem('factory-vkey', k);
    }
    return k;
  } catch {
    return 'anon-' + Math.random().toString(36).slice(2, 12);
  }
}

function vistas(): string[] {
  try {
    return JSON.parse(localStorage.getItem('factory-respostas-vistas') ?? '[]') as string[];
  } catch {
    return [];
  }
}

const caixa = { background: '#0F1318', border: '1px solid #E6AC3F', color: '#EEF1F6', font: '13px ' + MONO, padding: 12, width: 360, maxHeight: '60vh', overflow: 'auto' } as const;
const campo = { background: '#08090C', border: '1px solid #262E3A', color: '#EEF1F6', font: '13px ' + MONO, padding: 8, width: '100%', boxSizing: 'border-box', resize: 'vertical' } as const;
const botao = { background: '#E6AC3F', color: '#08090C', border: 0, font: '700 12px ' + MONO, letterSpacing: '.08em', padding: '7px 12px', cursor: 'pointer' } as const;
const discreto = { background: '#0F1318', color: '#EEF1F6', border: '1px solid #262E3A', font: '11px ' + MONO, padding: '4px 8px', cursor: 'pointer' } as const;

// Recados para o CEO: o visitante deixa o recado (fica no banco) e ve a resposta quando voltar; o CEO ve tudo numa caixa de entrada simples.
export function Recados() {
  const dono = isOwner();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [msg, setMsg] = useState('');
  const [meus, setMeus] = useState<Meu[]>([]);
  const [todos, setTodos] = useState<Caixa[]>([]);
  const [rascunho, setRascunho] = useState<Record<string, string>>({});
  const [vistasIds, setVistasIds] = useState<string[]>(vistas());

  const carregar = useCallback(async () => {
    if (dono) {
      const { data } = await sb.from('factory_messages').select('*').order('created_at', { ascending: false }).limit(100);
      setTodos((data ?? []) as Caixa[]);
    } else {
      const { data } = await sb.rpc('factory_minhas_mensagens', { p_key: chaveVisitante() });
      setMeus((data ?? []) as Meu[]);
    }
  }, [dono]);

  useEffect(() => {
    void carregar();
    const t = setInterval(() => void carregar(), 15_000);
    return () => clearInterval(t);
  }, [carregar]);

  const naoLidos = todos.filter((m) => !m.read_at).length;
  const [aviso, setAviso] = useState('');
  const antes = useRef<number | null>(null);
  const tituloBase = useRef(document.title);

  // Aviso ao CEO: quando o numero de nao lidos sobe, mostra um aviso, toca um bipe e marca o titulo da aba.
  useEffect(() => {
    if (!dono) return;
    document.title = (naoLidos ? '(' + naoLidos + ') ' : '') + tituloBase.current;
    const prev = antes.current;
    antes.current = naoLidos;
    if (prev === null || naoLidos <= prev) return;
    const novo = todos.find((m) => !m.read_at);
    setAviso('Novo recado' + (novo ? ' de ' + novo.visitor_name : ''));
    setTimeout(() => setAviso(''), 8000);
    try {
      const ctx = new AudioContext();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.value = 0.08;
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.18);
    } catch {
      /* sem audio */
    }
    try {
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification('AI Games Factory', { body: novo ? novo.visitor_name + ': ' + novo.body.slice(0, 80) : 'Novo recado' });
    } catch {
      /* sem notificacao */
    }
  }, [dono, naoLidos, todos]);

  useEffect(() => {
    if (dono && 'Notification' in window && Notification.permission === 'default') void Notification.requestPermission().catch(() => undefined);
  }, [dono]);
  // a recepcionista (Bia) abre a caixa quando alguem fala com ela e avisa o CEO dos recados novos
  const abrirRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    const abre = () => abrirRef.current();
    window.addEventListener('factory-recepcao', abre);
    return () => window.removeEventListener('factory-recepcao', abre);
  }, []);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('factory-recados-nao-lidos', { detail: dono ? naoLidos : 0 }));
  }, [dono, naoLidos]);
  const novasRespostas = meus.filter((m) => m.reply && !vistasIds.includes(m.id));

  const abrir = () => {
    const prox = !aberto;
    setAberto(prox);
    if (prox && !dono) {
      const ids = meus.filter((m) => m.reply).map((m) => m.id);
      try {
        localStorage.setItem('factory-respostas-vistas', JSON.stringify(ids));
      } catch {
        /* sem armazenamento */
      }
      setVistasIds(ids);
    }
    if (prox) void carregar();
  };

  abrirRef.current = () => {
    if (!aberto) abrir();
  };

  const enviar = async () => {
    const body = texto.trim();
    if (!body) return;
    setMsg('Enviando…');
    const { error } = await sb.from('factory_messages').insert({ visitor_key: chaveVisitante(), visitor_name: me.name || 'Visitante', body });
    if (error) {
      setMsg('Não foi possível enviar.');
      return;
    }
    setTexto('');
    setMsg('Recado enviado. Volte depois para ver a resposta.');
    window.dispatchEvent(new CustomEvent('factory-recado-anotado'));
    void carregar();
  };

  const responder = async (m: Caixa) => {
    const reply = (rascunho[m.id] ?? '').trim();
    if (!reply) return;
    await sb.from('factory_messages').update({ reply, replied_at: new Date().toISOString(), read_at: m.read_at ?? new Date().toISOString() }).eq('id', m.id);
    setRascunho({ ...rascunho, [m.id]: '' });
    void carregar();
  };

  const marcarLido = async (m: Caixa) => {
    await sb.from('factory_messages').update({ read_at: new Date().toISOString() }).eq('id', m.id);
    void carregar();
  };

  const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const rotulo = dono ? 'Caixa de entrada' + (naoLidos ? ' (' + naoLidos + ')' : '') : 'Falar com o CEO' + (novasRespostas.length ? ' • ' + novasRespostas.length + ' resposta(s)' : '');

  return (
    <>
      <button style={{ ...discreto, ...(naoLidos || novasRespostas.length ? { borderColor: '#FFC95C', color: '#FFC95C' } : {}) }} onClick={abrir}>
        {rotulo}
      </button>
      {aviso && !aberto && (
        <div style={{ position: 'fixed', left: 200, top: 84, zIndex: 40, background: '#0F1318', border: '1px solid #FFC95C', color: '#FFC95C', font: '700 13px ' + MONO, padding: '10px 14px', cursor: 'pointer' }} onClick={() => { setAviso(''); abrir(); }}>
          ✉ {aviso} — clique para abrir
        </div>
      )}
      {aberto && (
        <div style={{ position: 'fixed', left: 200, top: 84, zIndex: 40, ...caixa }}>
          {dono ? (
            <>
              <div style={{ color: '#FFC95C', fontWeight: 700, marginBottom: 8 }}>CAIXA DE ENTRADA</div>
              {todos.length === 0 && <div style={{ color: '#A9B3C4' }}>Nenhum recado ainda.</div>}
              {todos.map((m) => (
                <div key={m.id} style={{ borderTop: '1px solid #262E3A', padding: '8px 0' }}>
                  <div style={{ color: m.read_at ? '#A9B3C4' : '#FFC95C', fontSize: 11 }}>
                    {m.visitor_name} · {quando(m.created_at)} {!m.read_at && '· NOVO'}
                  </div>
                  <div style={{ margin: '4px 0', whiteSpace: 'pre-wrap' }}>{m.body}</div>
                  {m.reply ? (
                    <div style={{ color: '#7AD1E0', whiteSpace: 'pre-wrap' }}>↳ você ({quando(m.replied_at ?? m.created_at)}): {m.reply}</div>
                  ) : (
                    <>
                      <textarea rows={2} style={campo} placeholder="sua resposta" value={rascunho[m.id] ?? ''} onChange={(e) => setRascunho({ ...rascunho, [m.id]: e.target.value })} />
                      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        <button style={botao} onClick={() => void responder(m)}>RESPONDER</button>
                        {!m.read_at && (
                          <button style={discreto} onClick={() => void marcarLido(m)}>
                            marcar como lido
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </>
          ) : (
            <>
              <div style={{ color: '#FFC95C', fontWeight: 700, marginBottom: 6 }}>RECADO PARA O CEO · A BIA ANOTA</div>
              <div style={{ color: '#A9B3C4', marginBottom: 6 }}>Se ele não estiver por aqui, o recado fica guardado e a resposta aparece aqui quando você voltar a este navegador.</div>
              <textarea rows={3} maxLength={1000} style={campo} placeholder="escreva seu recado" value={texto} onChange={(e) => setTexto(e.target.value)} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                <button style={botao} onClick={() => void enviar()}>ENVIAR</button>
                <span style={{ color: '#A9B3C4', fontSize: 11 }}>{msg}</span>
              </div>
              {meus.length > 0 && <div style={{ color: '#FFC95C', fontWeight: 700, margin: '10px 0 2px' }}>SEUS RECADOS</div>}
              {meus.map((m) => (
                <div key={m.id} style={{ borderTop: '1px solid #262E3A', padding: '6px 0' }}>
                  <div style={{ color: '#A9B3C4', fontSize: 11 }}>{quando(m.created_at)}</div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>
                  {m.reply ? (
                    <div style={{ color: '#7AD1E0', whiteSpace: 'pre-wrap' }}>↳ CEO: {m.reply}</div>
                  ) : (
                    <div style={{ color: '#5C6678' }}>aguardando resposta…</div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </>
  );
}
