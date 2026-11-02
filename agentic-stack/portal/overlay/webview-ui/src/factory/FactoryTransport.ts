import {
  TRANSPORT_STATE_CONNECTED,
  TRANSPORT_STATE_CONNECTING,
  TRANSPORT_STATE_RECONNECTING,
} from '../../../core/src/constants.js';
import type { ClientMessage, ServerMessage } from '../../../core/src/messages.js';
import type { MessageTransport, TransportState } from '../transport/types.js';
import { GAMES } from './config.js';
import { guardarLayout } from './layoutStore.js';
import { getMeta } from './meta.js';
import { registry } from './registry.js';
import { roleLabel } from './roles.js';
import { isOwner } from './session.js';
import { sb } from './supabase.js';

// Sinal da fabrica (tabela factory_events) -> mensagens que o Pixel Agents ja entende.
// So leitura: tudo que o webview manda (send) e ignorado.

interface FactoryEvent {
  ts: string;
  game: string;
  session_id: string | null;
  agent: string;
  agent_id: string | null;
  event: string;
  tool: string | null;
  target: string | null;
}

const READING_TOOLS = ['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch'];
const SUBAGENT_TOOLS = ['Task', 'Agent'];
const VERB: Record<string, string> = {
  Read: 'Reading',
  Grep: 'Searching',
  Glob: 'Globbing',
  WebFetch: 'Fetching',
  WebSearch: 'Searching web',
  Write: 'Writing',
  Edit: 'Editing',
  MultiEdit: 'Editing',
  Bash: 'Running',
  Task: 'Task',
  Agent: 'Task',
};
const IDLE_AFTER_MS = 2 * 60 * 1000;
const FERIAS_MS = 7 * 24 * 60 * 60 * 1000; // sem demanda ha mais de 1 semana: ferias na piscina

type Escritorio = { factoryFerias(id: number, on: boolean): void };
const escritorio = (): Escritorio | undefined => (window as unknown as { __factoryOffice?: Escritorio }).__factoryOffice;
const PALETTES = 30;
const PALETA_BIA = 13; // reservada para a recepcionista

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export class FactoryTransport implements MessageTransport {
  private handlers: Array<(msg: ServerMessage) => void> = [];
  private stateHandlers: Array<(s: TransportState) => void> = [];
  private _state: TransportState = TRANSPORT_STATE_CONNECTING;
  readonly ready: Promise<void> = Promise.resolve();

  private paletasUsadas = new Set<number>();
  private ids = new Map<string, number>();
  private lastSeen = new Map<number, number>();
  private pending = new Map<number, Array<{ toolId: string; tool: string }>>();
  private nextId = 1;
  private toolSeq = 0;
  private feedStarted = false;
  private sweep: ReturnType<typeof setInterval> | null = null;
  private meta = new Map<string, { squad: string; equipe: Record<string, string> }>();
  private keys = new Map<number, { game: string; agent: string }>();
  private banner: HTMLElement | null = null;
  private ferias = new Set<number>();

  // Ferias: a view factory_agent_ultimo (ultimo e primeiro evento de cada agente) e o dono do dado. Sem historico de 1 semana, ninguem esta de ferias.
  private async carregarFerias(): Promise<void> {
    const { data, error } = await sb.from('factory_agent_ultimo').select('game,agent,ultimo,primeiro');
    if (error || !data || data.length === 0) return;
    const rows = data as unknown as Array<{ game: string; agent: string; ultimo: string; primeiro: string }>;
    const inicio = Math.min(...rows.map((r) => Date.parse(r.primeiro)));
    const ult = new Map(rows.map((r) => [`${r.game}|${r.agent}`, Date.parse(r.ultimo)]));
    const corte = Date.now() - FERIAS_MS;
    for (const [id, k] of this.keys) {
      if ((ult.get(`${k.game}|${k.agent}`) ?? inicio) >= corte) continue;
      this.ferias.add(id);
      escritorio()?.factoryFerias(id, true);
    }
  }

  constructor() {
    // O mock de assets (browserMock) injeta mensagens como eventos da janela: ponte para o webview.
    window.addEventListener('message', (e: MessageEvent) => {
      const data = e.data as { type?: unknown } | null;
      if (!data || typeof data.type !== 'string') return;
      this.deliver(data as ServerMessage);
      // O layout e a ultima peca do carregamento: so entao comecam a chegar os agentes.
      if (data.type === 'layoutLoaded') void this.startFeed();
    });
  }

  get state(): TransportState {
    return this._state;
  }

  private setState(next: TransportState): void {
    if (this._state === next) return;
    this._state = next;
    for (const h of this.stateHandlers) h(next);
  }

  send(message: ClientMessage): void {
    // Unica escrita permitida: o CEO salvando o layout do editor.
    const m = message as { type?: string; layout?: Record<string, unknown> };
    if (m.type === 'saveLayout' && m.layout) guardarLayout(m.layout);
  }

  onMessage(handler: (message: ServerMessage) => void): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  onStateChange(handler: (state: TransportState) => void): () => void {
    this.stateHandlers.push(handler);
    return () => {
      this.stateHandlers = this.stateHandlers.filter((h) => h !== handler);
    };
  }

  dispose(): void {
    if (this.sweep) clearInterval(this.sweep);
    this.handlers = [];
    this.stateHandlers = [];
  }

  private deliver(m: ServerMessage): void {
    for (const h of this.handlers) h(m);
  }

  private emit(m: Record<string, unknown>): void {
    this.deliver(m as unknown as ServerMessage);
  }

  private async startFeed(): Promise<void> {
    if (this.feedStarted) return;
    this.feedStarted = true;
    this.emit({
      type: 'providerCapabilities',
      readingTools: READING_TOOLS,
      subagentToolNames: SUBAGENT_TOOLS,
    });

    // O squad inteiro chega de uma vez, sentado na sala de estar, mesmo antes de qualquer evento.
    this.drawBanner();
    await Promise.all(GAMES.map((g) => this.loadMeta(g)));

    // Teste local (VITE_DEMO=1 no build): eventos sinteticos, sem login nem banco.
    if (import.meta.env.VITE_DEMO) {
      this.setState(TRANSPORT_STATE_CONNECTED);
      const squad = [
        ['naval-battle', 'tech-lead', 'Read', 'src/Game.kt'],
        ['naval-battle', 'qa', 'Grep', 'TODO'],
        ['naval-battle', 'suporte', 'Edit', 'docs/CHANGELOG.md'],
        ['naval-battle', 'dev', 'Write', 'src/Fleet.kt'],
      ] as const;
      let n = 0;
      const tick = () => {
        const [game, agent, tool, target] = squad[n++ % squad.length];
        const base = { ts: new Date().toISOString(), game, session_id: 's', agent, agent_id: null, tool, target };
        this.handle({ ...base, event: 'PreToolUse' });
        setTimeout(() => this.handle({ ...base, ts: new Date().toISOString(), event: 'PostToolUse' }), 2500);
        setTimeout(() => this.handle({ ...base, ts: new Date().toISOString(), event: 'Stop' }), 5000);
      };
      tick();
      setInterval(tick, 1500);
      return;
    }

    // Visitante (sem login): so a visao publica, sem arquivo, custo nem sessao, lida por consulta periodica.
    if (!isOwner()) {
      await this.visitorFeed();
      return;
    }

    // CEO: tabela completa. Consulta periodica em vez de websocket: no Android o navegador derruba a conexao em
    // segundo plano e os eventos do intervalo se perdiam; a consulta por "ts maior que o ultimo" sempre recupera.
    await this.poll('factory_events', 'ts,game,session_id,agent,agent_id,event,tool,target', (r) => r as FactoryEvent);
  }

  private async visitorFeed(): Promise<void> {
    type Pub = { ts: string; game: string; agent: string; event: string; tool: string | null };
    const conv = (r: Pub): FactoryEvent => ({ ...r, session_id: null, agent_id: null, target: null });
    await this.poll('factory_events_public', 'ts,game,agent,event,tool', (r) => conv(r as Pub));
  }

  // Carga inicial (300 mais recentes) e depois consulta a cada 2,5 s; ao voltar para a aba ou a rede, consulta na hora.
  private async poll(table: string, cols: string, conv: (r: unknown) => FactoryEvent): Promise<void> {
    const { data } = await sb.from(table).select(cols).order('ts', { ascending: false }).limit(300);
    let ultimo = '';
    for (const r of ((data ?? []) as unknown as Array<{ ts: string }>).reverse()) {
      this.handle(conv(r));
      ultimo = r.ts;
    }
    this.settleStale();
    this.setState(TRANSPORT_STATE_CONNECTED);
    // Ao carregar, cada agente ja nasce onde deve estar (trabalhando na mesa ou sentado no lazer): sem correria inicial.
    const posicionar = () => {
      const o = (window as unknown as { __factoryOffice?: { factoryTeleport(id: number): void } }).__factoryOffice;
      if (o) for (const id of this.keys.keys()) o.factoryTeleport(id);
    };
    posicionar();
    setTimeout(posicionar, 300);
    setTimeout(posicionar, 1200);
    void this.carregarFerias().then(() => setTimeout(posicionar, 100));
    setInterval(() => void this.carregarFerias(), 30 * 60 * 1000);
    let busy = false;
    const tick = async () => {
      if (busy) return;
      busy = true;
      try {
        this.settleStale();
        let q = sb.from(table).select(cols).order('ts', { ascending: true }).limit(200);
        if (ultimo) q = q.gt('ts', ultimo);
        const { data: novos, error } = await q;
        if (error) {
          this.setState(TRANSPORT_STATE_RECONNECTING);
          return;
        }
        this.setState(TRANSPORT_STATE_CONNECTED);
        for (const r of (novos ?? []) as unknown as Array<{ ts: string }>) {
          this.handle(conv(r));
          ultimo = r.ts;
        }
      } catch {
        this.setState(TRANSPORT_STATE_RECONNECTING);
      } finally {
        busy = false;
      }
    };
    this.sweep = setInterval(() => void tick(), 2500);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) void tick();
    });
    window.addEventListener('online', () => void tick());
    window.addEventListener('focus', () => void tick());
  }

  private settleStale(): void {
    const now = Date.now();
    for (const [id, t] of this.lastSeen) {
      if (now - t > IDLE_AFTER_MS) {
        this.rest(id);
        this.lastSeen.delete(id);
      }
    }
  }

  private rest(id: number): void {
    this.pending.set(id, []);
    this.emit({ type: 'agentToolsClear', id });
    this.emit({ type: 'agentStatus', id, status: 'waiting' });
  }

  private agentFor(e: FactoryEvent): number {
    const key = `${e.game}|${e.agent}`;
    let id = this.ids.get(key);
    if (id === undefined) {
      id = this.nextId++;
      this.ids.set(key, id);
      this.emit({
        type: 'agentCreated',
        id,
        directoryName: e.game,
        palette: this.paletaUnica(key),
      });
      this.keys.set(id, { game: e.game, agent: e.agent });
      this.sendTeamInfo(id);
      void this.loadMeta(e.game);
    }
    return id;
  }

  // Cada agente com um avatar proprio: sorteio fixo pela chave jogo|agente (o mesmo agente sempre tem a mesma cara), pulando os ja usados.
  private paletaUnica(key: string): number {
    let p = hash(key) % PALETTES;
    for (let i = 0; i < PALETTES && (p === PALETA_BIA || this.paletasUsadas.has(p)); i++) p = (p + 1) % PALETTES;
    this.paletasUsadas.add(p);
    return p;
  }

  private label(game: string, agent: string): string {
    const apelido = this.meta.get(game)?.equipe[agent];
    return apelido ? `${apelido} (${roleLabel(agent, game)})` : roleLabel(agent, game);
  }

  private sendTeamInfo(id: number): void {
    const k = this.keys.get(id);
    if (!k) return;
    registry.setAgent(id, { game: k.game, role: k.agent, nome: this.meta.get(k.game)?.equipe[k.agent] ?? k.agent });
    this.emit({
      type: 'agentTeamInfo',
      id,
      teamName: k.game,
      agentName: this.label(k.game, k.agent),
      isTeamLead: false,
    });
  }

  // factory.yaml do jogo (o repo do jogo e o dono dos nomes): convencao johncoelho/<slug>.
  private async loadMeta(game: string): Promise<void> {
    if (this.meta.has(game)) return;
    this.meta.set(game, { squad: '', equipe: {} });
    const m = await getMeta(game);
    this.meta.set(game, { squad: m.squad, equipe: m.equipe });
    registry.setSquad(game, m.squad);
    for (const role of Object.keys(m.equipe)) this.agentFor({ game, agent: role } as FactoryEvent);
    for (const id of this.keys.keys()) this.sendTeamInfo(id);
    this.drawBanner();
  }

  // Titulo fixo no topo do mapa. O nome de cada squad fica escrito dentro da sala do time (areas do layout).
  private drawBanner(): void {
    if (this.banner) return;
    const b = document.createElement('div');
    b.textContent = 'AI GAMES FACTORY';
    b.style.cssText =
      'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:5;pointer-events:none;' +
      "padding:6px 16px;background:#0F1318;color:#FFC95C;border:1px solid #E6AC3F;box-shadow:0 0 0 2px #08090C;" +
      "font:700 14px 'Chakra Petch',system-ui,sans-serif;letter-spacing:.24em";
    document.body.appendChild(b);
    this.banner = b;
  }

  private handle(e: FactoryEvent): void {
    // So existem no escritorio os agentes do squad (equipe do factory.yaml do jogo): nada de personagem sobrando.
    const equipe = this.meta.get(e.game)?.equipe;
    if (!GAMES.includes(e.game) || !equipe || !(e.agent in equipe)) return;
    const id = this.agentFor(e);
    this.lastSeen.set(id, new Date(e.ts).getTime());
    // voltou a ter demanda: acaba as ferias (evento antigo do historico nao conta)
    if (this.ferias.size > 0 && Date.now() - new Date(e.ts).getTime() < FERIAS_MS && this.ferias.delete(id)) escritorio()?.factoryFerias(id, false);
    const stack = this.pending.get(id) ?? [];
    this.pending.set(id, stack);

    switch (e.event) {
      case 'PreToolUse': {
        const tool = e.tool ?? 'Task';
        const toolId = `t${++this.toolSeq}`;
        stack.push({ toolId, tool });
        const verb = VERB[tool] ?? tool;
        registry.setActivity(id, e.target ? `${verb} ${e.target}` : verb);
        // delegou a outro agente (Task): fica aguardando ele
        this.emit({ type: 'agentStatus', id, status: 'active', waitingAgent: tool === 'Task' });
        this.emit({
          type: 'agentToolStart',
          id,
          toolId,
          toolName: tool,
          status: e.target ? `${verb} ${e.target}` : verb,
        });
        break;
      }
      case 'PostToolUse': {
        const i = stack.map((s) => s.tool).lastIndexOf(e.tool ?? '');
        if (i >= 0) {
          const [done] = stack.splice(i, 1);
          this.emit({ type: 'agentToolDone', id, toolId: done.toolId });
          if (done.tool === 'Task') this.emit({ type: 'agentStatus', id, status: 'active' });
        }
        break;
      }
      case 'Stop':
      case 'SubagentStop':
      case 'SessionEnd':
        registry.setActivity(id, 'descansando');
        this.rest(id);
        break;
      case 'Notification':
        this.emit({ type: 'agentStatus', id, status: 'waiting', awaitingInput: true });
        break;
      default:
        this.emit({ type: 'agentStatus', id, status: 'active' });
    }
  }
}
