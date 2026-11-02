// Tela de entrada unica: nome, avatar e e-mail (opcional). O e-mail do dono recebe o link de acesso; qualquer outro entra como visitante.
import { OWNER_EMAIL } from './session.js';
import { sb } from './supabase.js';

export type Entrada = { kind: 'visitor'; name: string; palette: number };

const CHARS = Array.from({ length: 30 }, (_, i) => i);

// Sair: encerra a sessao (se houver), esquece o perfil guardado e volta para a tela de entrada.
export function sair(): void {
  try {
    localStorage.removeItem('factory-visitor');
  } catch {
    /* sem armazenamento */
  }
  void sb.auth.signOut().finally(() => location.reload());
}

// logado: ja ha sessao (Google ou link por e-mail); so falta escolher avatar e nome.
export function askEntry(root: HTMLElement, logado?: { nome: string }): Promise<Entrada> {
  let guardado: { name?: string; palette?: number } = {};
  try {
    guardado = JSON.parse(localStorage.getItem('factory-visitor') ?? '{}');
  } catch {
    /* sem armazenamento */
  }
  let palette = guardado.palette ?? 0;

  root.innerHTML = `
  <div style="min-height:100vh;display:grid;place-items:center;background:radial-gradient(1100px 640px at 50% -12%,#121722 0%,#08090C 60%);color:#EEF1F6;font-family:system-ui,sans-serif">
    <form id="f" style="width:min(460px,92vw);background:#0F1318;border:1px solid #262E3A;padding:24px;display:grid;gap:14px">
      <div style="font:11px ui-monospace,monospace;letter-spacing:.2em;color:#5C6678">BEM-VINDO(A) À</div>
      <div style="font-weight:700;letter-spacing:.14em;font-size:20px;color:#FFC95C">AI GAMES FACTORY</div>
      <div style="font:13px ui-monospace,monospace;color:#A9B3C4">Escolha seu avatar e seu nome. Você entra pela recepção e pode visitar as salas e ver os times trabalhando.</div>
      <div id="av" style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;max-height:232px;overflow-y:auto;padding:2px"></div>
      <input id="n" maxlength="16" placeholder="seu nome" required value="${(guardado.name ?? logado?.nome ?? '').replace(/"/g, '')}"
        style="background:#08090C;border:1px solid #262E3A;color:#EEF1F6;font:15px ui-monospace,monospace;padding:11px">
      ${logado ? '' : `<input id="e" type="email" maxlength="80" placeholder="e-mail (opcional)" autocomplete="email"
        style="background:#08090C;border:1px solid #262E3A;color:#EEF1F6;font:15px ui-monospace,monospace;padding:11px">`}
      <button style="background:#E6AC3F;color:#08090C;border:0;font-weight:700;letter-spacing:.1em;padding:12px;cursor:pointer">${logado ? 'ENTRAR NO ESCRITÓRIO' : 'ENTRAR PELA RECEPÇÃO'}</button>
      ${logado
        ? '<button type="button" id="x" style="background:none;border:0;color:#5C6678;font:12px ui-monospace,monospace;cursor:pointer;text-decoration:underline">Sair e entrar com outra conta</button>'
        : '<button type="button" id="g" style="background:#0F1318;color:#EEF1F6;border:1px solid #262E3A;font:600 13px system-ui,sans-serif;letter-spacing:.06em;padding:11px;cursor:pointer">ENTRAR COM GOOGLE</button>'}
      <p id="m" style="margin:0;font:12px ui-monospace,monospace;color:#A9B3C4"></p>
    </form>
  </div>`;

  const av = root.querySelector('#av') as HTMLElement;
  const pintar = () => {
    av.innerHTML = '';
    for (const i of CHARS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.style.cssText = `width:44px;height:72px;padding:0;cursor:pointer;background:#08090C;border:2px solid ${i === palette ? '#FFC95C' : '#262E3A'}`;
      const sp = document.createElement('div');
      sp.style.cssText = `width:32px;height:64px;margin:2px auto;image-rendering:pixelated;background:url(./assets/characters/char_${i}.png) 0 0/${112 * 2}px ${96 * 2}px no-repeat`;
      b.appendChild(sp);
      b.onclick = () => {
        palette = i;
        pintar();
      };
      av.appendChild(b);
    }
  };
  pintar();

  return new Promise<Entrada>((resolve) => {
    const g = root.querySelector('#g') as HTMLElement | null;
    if (g)
      g.onclick = () => {
        const msg = root.querySelector('#m') as HTMLElement;
        void sb.auth
          .signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } })
          .then(({ error }) => {
            if (error) msg.textContent = 'Não foi possível entrar com o Google.';
          });
      };
    const x = root.querySelector('#x') as HTMLElement | null;
    if (x) x.onclick = sair;
    (root.querySelector('#f') as HTMLFormElement).addEventListener('submit', (ev) => {
      ev.preventDefault();
      const email = ((root.querySelector('#e') as HTMLInputElement | null)?.value ?? '').trim().toLowerCase();
      const msg = root.querySelector('#m') as HTMLElement;
      if (email === OWNER_EMAIL) {
        // e-mail do dono: o link chega na caixa de entrada e a sessao liga o modo CEO
        msg.textContent = 'Enviando…';
        void sb.auth
          .signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: location.origin + location.pathname } })
          .then(({ error }) => {
            msg.textContent = error ? 'Não foi possível enviar o link.' : 'Link enviado. Abra o e-mail neste navegador.';
          });
        sb.auth.onAuthStateChange((evt, session) => {
          if (evt === 'SIGNED_IN' && session) location.reload();
        });
        return;
      }
      const name = (root.querySelector('#n') as HTMLInputElement).value.trim().slice(0, 16) || 'Visitante';
      try {
        localStorage.setItem('factory-visitor', JSON.stringify({ name, palette }));
      } catch {
        /* sem armazenamento */
      }
      resolve({ kind: 'visitor', name, palette });
    });
  });
}
