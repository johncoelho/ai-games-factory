import { type ReactNode, useSyncExternalStore } from 'react';

import { SQUADS } from './config.js';
import { registry } from './registry.js';

// Lista lateral de agentes agrupada por squad: um titulo por time e o nome de cada integrante sob o avatar.
export function CardGroups({ agentIds, render }: { agentIds: number[]; render: (id: number) => ReactNode }) {
  useSyncExternalStore(registry.subscribe, registry.version);

  const groups = new Map<string, number[]>();
  for (const id of agentIds) {
    const g = registry.agent(id)?.game ?? '';
    const lista = groups.get(g) ?? [];
    lista.push(id);
    groups.set(g, lista);
  }
  const ordem = [...SQUADS.map((s) => s.slug), ''];

  return (
    <>
      {ordem
        .filter((g) => groups.has(g))
        .map((g) => (
          <div key={g || 'outros'} className="flex flex-col items-center gap-2" style={{ marginBottom: 12 }}>
            <div
              style={{
                font: "700 10px ui-monospace,Consolas,'JetBrains Mono',monospace",
                letterSpacing: '.1em',
                color: '#FFC95C',
                textAlign: 'center',
                maxWidth: 76,
                lineHeight: 1.25,
                padding: '2px 4px',
                background: 'rgba(8,9,12,.85)',
                border: '1px solid #E6AC3F',
              }}
            >
              {registry.squad(g) || g || 'SEM SQUAD'}
            </div>
            {groups.get(g)!.map((id) => {
              const info = registry.agent(id);
              return (
                <div key={id} className="flex flex-col items-center" title={info ? `${info.nome} (${info.role})` : undefined}>
                  {render(id)}
                  <div
                    style={{
                      font: "10px ui-monospace,Consolas,'JetBrains Mono',monospace",
                      color: '#EEF1F6',
                      maxWidth: 76,
                      textAlign: 'center',
                      lineHeight: 1.2,
                      marginTop: 1,
                      textShadow: '1px 1px 0 #08090C',
                    }}
                  >
                    {info?.nome ?? ''}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
    </>
  );
}
