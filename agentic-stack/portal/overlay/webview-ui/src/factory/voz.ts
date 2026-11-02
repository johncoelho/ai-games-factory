// Conversa por voz entre humanos proximos: audio direto entre navegadores (WebRTC); o Supabase Realtime so leva os sinais de conexao.
// Quem esta perto fica conectado mesmo sem microfone (so ouve); ligar o microfone apenas poe a voz na linha (replaceTrack), sem renegociar.
export interface Sinal {
  from: string;
  to: string;
  kind: 'offer' | 'answer' | 'ice';
  data: unknown;
}

interface Par {
  pc: RTCPeerConnection;
  sender: RTCRtpSender | null;
  audio: HTMLAudioElement;
  fila: RTCIceCandidateInit[];
}

// navegadores bloqueiam audio sem gesto do usuario: no primeiro clique/tecla, libera os que ficaram esperando
let liberado = false;
const liberar = (pares: () => Iterable<Par>) => {
  if (liberado) return;
  liberado = true;
  const tocar = () => {
    for (const p of pares()) void p.audio.play().catch(() => undefined);
  };
  document.addEventListener('pointerdown', tocar, { capture: true });
  document.addEventListener('keydown', tocar, { capture: true });
};

const ICE = [{ urls: 'stun:stun.l.google.com:19302' }];

export class Voz {
  private local: MediaStream | null = null;
  private pares = new Map<string, Par>();

  private meu: string;
  private enviar: (s: Sinal) => void;

  constructor(meu: string, enviar: (s: Sinal) => void) {
    this.meu = meu;
    this.enviar = enviar;
    liberar(() => this.pares.values());
  }

  get ligado(): boolean {
    return this.local !== null;
  }

  async ligar(): Promise<boolean> {
    try {
      const fake = (window as unknown as { __factoryFakeMic?: boolean }).__factoryFakeMic;
      if (fake) {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const dest = ctx.createMediaStreamDestination();
        osc.connect(dest);
        osc.start();
        this.local = dest.stream;
      } else {
        this.local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      }
      this.colocarFaixa();
      return true;
    } catch {
      this.local = null;
      return false;
    }
  }

  desligar(): void {
    this.local?.getTracks().forEach((t) => t.stop());
    this.local = null;
    for (const par of this.pares.values()) void par.sender?.replaceTrack(null).catch(() => undefined);
  }

  // encerra tudo (sair do escritorio)
  encerrar(): void {
    this.desligar();
    for (const k of [...this.pares.keys()]) this.fechar(k);
  }

  private colocarFaixa(): void {
    const faixa = this.local?.getAudioTracks()[0] ?? null;
    for (const par of this.pares.values()) void par.sender?.replaceTrack(faixa).catch(() => undefined);
  }

  // para testes e diagnostico
  estado(): Array<{ com: string; conexao: string; recebendo: boolean; faixaMuda: boolean }> {
    return [...this.pares.entries()].map(([k, p]) => ({ com: k, conexao: p.pc.connectionState, recebendo: !!p.audio.srcObject && !p.audio.paused, faixaMuda: (p.audio.srcObject as MediaStream | null)?.getTracks()[0]?.muted ?? true }));
  }

  conectados(): string[] {
    return [...this.pares.entries()].filter(([, p]) => p.pc.connectionState === 'connected').map(([k]) => k);
  }

  // perto: quem esta ao alcance (com microfone ligado) e a distancia em tiles; o volume cai com a distancia.
  atualizar(perto: Map<string, number>): void {
    for (const [k, d] of perto) {
      const par = this.pares.get(k);
      if (par) par.audio.volume = Math.max(0.15, Math.min(1, 1 - d / 12));
      else if (this.meu < k) void this.chamar(k);
    }
    for (const k of [...this.pares.keys()]) if (!perto.has(k)) this.fechar(k);
  }

  private criar(k: string, comoQuemChama: boolean): Par {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const audio = new Audio();
    audio.autoplay = true;
    const par: Par = { pc, sender: null, fila: [], audio };
    if (comoQuemChama) {
      const tr = pc.addTransceiver('audio', { direction: 'sendrecv' });
      par.sender = tr.sender;
      void tr.sender.replaceTrack(this.local?.getAudioTracks()[0] ?? null).catch(() => undefined);
    }
    pc.ontrack = (e) => {
      audio.srcObject = new MediaStream([e.track]);
      void audio.play().catch(() => undefined);
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) this.enviar({ from: this.meu, to: k, kind: 'ice', data: e.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.fechar(k);
    };
    this.pares.set(k, par);
    return par;
  }

  private async chamar(k: string): Promise<void> {
    const par = this.criar(k, true);
    const offer = await par.pc.createOffer();
    await par.pc.setLocalDescription(offer);
    this.enviar({ from: this.meu, to: k, kind: 'offer', data: offer });
  }

  async sinal(s: Sinal): Promise<void> {
    if (s.to !== this.meu) return;
    let par = this.pares.get(s.from);
    if (s.kind === 'offer') {
      if (par) this.fechar(s.from);
      par = this.criar(s.from, false);
      await par.pc.setRemoteDescription(s.data as RTCSessionDescriptionInit);
      const tr = par.pc.getTransceivers()[0];
      if (tr) {
        tr.direction = 'sendrecv';
        par.sender = tr.sender;
        void tr.sender.replaceTrack(this.local?.getAudioTracks()[0] ?? null).catch(() => undefined);
      }
      const answer = await par.pc.createAnswer();
      await par.pc.setLocalDescription(answer);
      this.enviar({ from: this.meu, to: s.from, kind: 'answer', data: answer });
      await this.esvaziar(par);
    } else if (!par) {
      return;
    } else if (s.kind === 'answer') {
      await par.pc.setRemoteDescription(s.data as RTCSessionDescriptionInit);
      await this.esvaziar(par);
    } else if (par.pc.remoteDescription) {
      await par.pc.addIceCandidate(s.data as RTCIceCandidateInit);
    } else {
      par.fila.push(s.data as RTCIceCandidateInit);
    }
  }

  private async esvaziar(par: Par): Promise<void> {
    for (const c of par.fila.splice(0)) await par.pc.addIceCandidate(c);
  }

  private fechar(k: string): void {
    const par = this.pares.get(k);
    if (!par) return;
    this.pares.delete(k);
    par.pc.close();
    par.audio.srcObject = null;
  }
}
