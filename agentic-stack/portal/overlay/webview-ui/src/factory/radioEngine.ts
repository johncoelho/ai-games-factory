// Radio do escritorio: musica 8-bit calma, 100% procedural (WebAudio). Sem arquivos, sem rede.
// O AudioContext so nasce dentro de ligar(), que a UI chama a partir de um clique.

const BPM = 84;
const PASSO = 60 / BPM / 2; // colcheia
const NOTAS_A = 440;
const nota = (semitons: number): number => NOTAS_A * Math.pow(2, semitons / 12);

// Progressao Am - F - C - G (8 colcheias por acorde), em semitons relativos ao La 440.
const ACORDES: { baixo: number; arp: number[] }[] = [
  { baixo: -24, arp: [0, 3, 7, 12, 7, 3, 7, 3] },
  { baixo: -28, arp: [-4, 0, 3, 8, 3, 0, 3, 0] },
  { baixo: -21, arp: [3, 7, 10, 15, 10, 7, 10, 7] },
  { baixo: -26, arp: [-2, 2, 5, 10, 5, 2, 5, 2] },
];
// melodia lenta (1 nota por 2 colcheias; null = pausa)
const MELODIA: (number | null)[][] = [
  [12, null, 15, null, 14, null, 12, null],
  [8, null, 12, null, 10, null, 8, null],
  [15, null, 19, null, 17, null, 15, null],
  [14, null, 10, null, 14, null, null, null],
];

export const VOLUME_PADRAO = 0.25;

export class RadioEngine {
  private ctx: AudioContext | null = null;
  private mestre: GainNode | null = null;
  private ruido: AudioBuffer | null = null;
  private timer: number | null = null;
  private proximo = 0;
  private passo = 0;
  private volume = VOLUME_PADRAO;
  private oculta = false;

  get tocando(): boolean {
    return this.ctx !== null;
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.mestre && this.ctx) this.mestre.gain.setTargetAtTime(this.volume * 0.35, this.ctx.currentTime, 0.02);
    this.aplicarPausa();
  }

  // suspende com a aba oculta ou com volume 0 (nao gasta CPU a toa); retoma quando nenhum dos dois vale
  private aplicarPausa(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (this.oculta || this.volume === 0) {
      void ctx.suspend().catch(() => undefined);
    } else {
      this.proximo = Math.max(this.proximo, ctx.currentTime + 0.05);
      void ctx.resume().catch(() => undefined);
    }
  }

  /** Chamar so a partir de um gesto do usuario (clique). */
  ligar(): boolean {
    if (this.ctx) return true;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return false;
      const ctx = new Ctor();
      this.ctx = ctx;
      const mestre = ctx.createGain();
      mestre.gain.value = this.volume * 0.35;
      mestre.connect(ctx.destination);
      this.mestre = mestre;
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.ruido = buf;
      this.passo = 0;
      this.proximo = ctx.currentTime + 0.1;
      this.aplicarPausa();
      this.timer = window.setInterval(() => this.agendar(), 100);
      this.agendar();
      return true;
    } catch {
      this.desligar();
      return false;
    }
  }

  desligar(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    const ctx = this.ctx;
    this.ctx = null;
    this.mestre = null;
    this.ruido = null;
    if (ctx) void ctx.close().catch(() => undefined);
  }

  /** Aba oculta: suspende. Volta quando ficar visivel de novo (so se estava ligada). */
  pausar(p: boolean): void {
    this.oculta = p;
    this.aplicarPausa();
  }

  private agendar(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state === 'suspended') return;
    while (this.proximo < ctx.currentTime + 0.4) {
      this.tocarPasso(this.passo, this.proximo);
      this.proximo += PASSO;
      this.passo = (this.passo + 1) % (ACORDES.length * 8);
    }
  }

  private tocarPasso(n: number, t: number): void {
    const ac = ACORDES[Math.floor(n / 8)];
    const i = n % 8;
    if (i === 0 || i === 4) this.voz('triangle', nota(ac.baixo), t, PASSO * 3.6, 0.9);
    this.voz('square', nota(ac.arp[i]), t, PASSO * 0.9, 0.12);
    const m = MELODIA[Math.floor(n / 8)][i];
    if (m !== null) this.voz('square', nota(m), t, PASSO * 1.9, 0.16, 0.012);
    if (i % 2 === 1) this.chiado(t, 0.05, 0.05); // chimbal bem leve
    if (i === 4) this.chiado(t, 0.09, 0.09);
  }

  private voz(tipo: OscillatorType, freq: number, t: number, dur: number, ganho: number, ataque = 0.005): void {
    if (!this.ctx || !this.mestre) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = tipo;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(ganho, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.mestre);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private chiado(t: number, dur: number, ganho: number): void {
    if (!this.ctx || !this.mestre || !this.ruido) return;
    const s = this.ctx.createBufferSource();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    s.buffer = this.ruido;
    f.type = 'highpass';
    f.frequency.value = 6000;
    g.gain.setValueAtTime(ganho, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.mestre);
    s.start(t);
    s.stop(t + dur + 0.02);
  }
}
