// Tela de carregamento em pixels: um personagem caminha ao longo da barra enquanto o escritorio e montado.
const MONO = "ui-monospace,Consolas,'JetBrains Mono',monospace";

export function mostrarCarregando(root: HTMLElement, palette = 0, texto = 'MONTANDO O ESCRITÓRIO'): void {
  if (!document.getElementById('factory-loader-css')) {
    const st = document.createElement('style');
    st.id = 'factory-loader-css';
    // folha 112x96: 7 quadros de 16x32; linha 3 = andando para a direita (y=64). Escala 3x.
    st.textContent =
      '@keyframes fl-anda{from{background-position:0 -192px}to{background-position:-144px -192px}}' +
      '@keyframes fl-vai{from{left:0}to{left:calc(100% - 48px)}}' +
      '@keyframes fl-bloco{0%,100%{opacity:.25}50%{opacity:1}}';
  }
  const blocos = Array.from({ length: 16 }, (_, i) => `<i style="width:12px;height:12px;background:#E6AC3F;animation:fl-bloco 1.6s steps(2) ${(i * 0.1).toFixed(1)}s infinite"></i>`).join('');
  root.innerHTML = `
  <div style="min-height:100vh;display:grid;place-items:center;background:radial-gradient(1100px 640px at 50% -12%,#121722 0%,#08090C 60%);color:#EEF1F6">
    <div style="width:min(420px,86vw);display:grid;gap:14px;justify-items:center">
      <div style="font:700 16px ${MONO};letter-spacing:.24em;color:#FFC95C">AI GAMES FACTORY</div>
      <div style="position:relative;width:100%;height:100px">
        <div style="position:absolute;left:0;top:0;width:48px;height:96px;image-rendering:pixelated;animation:fl-vai 3.2s linear infinite alternate">
          <div style="width:48px;height:96px;image-rendering:pixelated;background:url(./assets/characters/char_${palette}.png) 0 -192px/336px 288px no-repeat;animation:fl-anda .6s steps(3) infinite"></div>
        </div>
        <div style="position:absolute;left:0;right:0;bottom:0;height:4px;background:#262E3A"></div>
      </div>
      <div style="display:flex;gap:4px">${blocos}</div>
      <div style="font:12px ${MONO};letter-spacing:.16em;color:#A9B3C4">${texto}</div>
    </div>
  </div>`;
}
