import './index.css';
import '@xterm/xterm/css/xterm.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.tsx';
import { askEntry } from './factory/gate.js';
import { mostrarCarregando } from './factory/loader.js';
import { OWNER_EMAIL, me } from './factory/session.js';
import { sb } from './factory/supabase.js';

async function main() {
  const root = document.getElementById('root')!;
  mostrarCarregando(root);
  // Os assets (moveis, pisos, personagens) comecam a baixar ja, enquanto o login e a tela de entrada acontecem.
  const assetsPronto = import('./browserMock.js').then((m) => m.initBrowserMock());
  assetsPronto.catch(() => undefined);
  const { data } = await sb.auth.getSession();
  const demo = Boolean(import.meta.env.VITE_DEMO);
  const querVisitante = demo && new URLSearchParams(location.search).has('visitante');

  const user = data.session?.user;
  const dono = user?.email === OWNER_EMAIL;
  let perfil: { name?: string; palette?: number } = {};
  try {
    perfil = JSON.parse(localStorage.getItem('factory-visitor') ?? '{}');
  } catch {
    /* sem armazenamento */
  }
  const trocar = sessionStorage.getItem('factory-trocar') === '1';
  sessionStorage.removeItem('factory-trocar');

  if (demo && !querVisitante) {
    me.role = 'ceo';
    me.name = 'John';
    me.palette = 1;
  } else if (user || querVisitante || !demo) {
    // Logado (CEO ou visitante com Google/e-mail): so escolhe avatar e nome na primeira vez ou ao trocar.
    // Sem login: tela de entrada (nome, avatar, e-mail opcional, Google).
    let nome = perfil.name;
    let palette = perfil.palette;
    if (user && (trocar || nome === undefined || palette === undefined)) {
      const meta = (user.user_metadata ?? {}) as { name?: string; full_name?: string };
      const e = await askEntry(root, { nome: meta.full_name ?? meta.name ?? (dono ? 'John' : '') });
      nome = e.name;
      palette = e.palette;
    } else if (!user) {
      const e = await askEntry(root);
      nome = e.name;
      palette = e.palette;
    }
    me.role = dono ? 'ceo' : 'visitor';
    me.name = nome ?? 'Visitante';
    me.palette = palette ?? 0;
    root.innerHTML = '';
  }
  mostrarCarregando(root, perfil.palette ?? me.palette ?? 0);

  // Assets do escritorio sao decodificados no proprio navegador (sem servidor).
  await assetsPronto;
  root.innerHTML = '';
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

main().catch(console.error);
