// factory.yaml do jogo: o repo do jogo e o dono dos nomes, do letreiro e das etapas. Convencao de repo: johncoelho/<slug>.
import { SQUADS } from './config.js';

export interface GameMeta {
  squad: string;
  equipe: Record<string, string>;
  etapas: Record<string, string[]>;
  quadro: { owner: string; numero: number } | null;
}

const cache = new Map<string, Promise<GameMeta>>();
const vazio = (): GameMeta => ({ squad: '', equipe: {}, etapas: {}, quadro: null });

export function parseFactoryYaml(txt: string): GameMeta {
  const m = vazio();
  let secao = '';
  for (const raw of txt.split(String.fromCharCode(10))) {
    const l = raw.trimEnd();
    const i = l.indexOf(':');
    if (i < 0 || l.trimStart().startsWith('#')) continue;
    const chave = l.slice(0, i).trim();
    const valor = l.slice(i + 1).trim();
    if (l[0] !== ' ' && l[0] !== String.fromCharCode(9)) {
      secao = chave;
      if (chave === 'nome_squad') m.squad = valor;
      if (chave === 'quadro') {
        const owner = /owner:\s*([A-Za-z0-9-]+)/.exec(valor)?.[1];
        const numero = Number(/numero:\s*(\d+)/.exec(valor)?.[1]);
        if (owner && numero) m.quadro = { owner, numero };
      }
    } else if (valor && secao === 'equipe') {
      m.equipe[chave] = valor;
    } else if (valor && secao === 'etapas') {
      m.etapas[chave] = valor.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return m;
}

export function getMeta(game: string): Promise<GameMeta> {
  let p = cache.get(game);
  if (!p) {
    p = fetch(SQUADS.find((x) => x.slug === game)?.yaml ?? `https://raw.githubusercontent.com/johncoelho/${game}/main/factory.yaml`)
      .then((r) => (r.ok ? r.text().then(parseFactoryYaml) : vazio()))
      .catch(vazio);
    cache.set(game, p);
  }
  return p;
}
