// Quem e cada agente (jogo, papel, apelido) e o nome de cada squad: o transporte preenche, a lista lateral le.
export interface AgentInfo {
  game: string;
  role: string;
  nome: string;
}

const agents = new Map<number, AgentInfo>();
const squads = new Map<string, string>();
const activity = new Map<number, string>();
const listeners = new Set<() => void>();
let version = 0;

function notify(): void {
  version++;
  for (const f of listeners) f();
}

export const registry = {
  setAgent(id: number, info: AgentInfo): void {
    agents.set(id, info);
    notify();
  },
  setSquad(slug: string, label: string): void {
    squads.set(slug, label);
    notify();
  },
  setActivity(id: number, text: string): void {
    activity.set(id, text);
  },
  activity: (id: number): string => activity.get(id) ?? '',
  agentIds: (): number[] => [...agents.keys()],
  agent: (id: number): AgentInfo | undefined => agents.get(id),
  squad: (slug: string): string | undefined => squads.get(slug),
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  version: (): number => version,
};
