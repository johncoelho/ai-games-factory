// Ajustes no Pixel Agents (versao fixada) para o comportamento da fabrica:
// agente sem trabalho fica sentado na sala de estar; ao ser demandado vai para o computador.
// Uso: node patches.mjs <pasta-do-pixel-agents>. Cada troca tem de casar exatamente uma vez, senao o build falha.
import fs from "node:fs";
import path from "node:path";
import { buildLayout } from "./layout.mjs";

const root = process.argv[2];
const src = (p) => (p.startsWith("src:") ? path.join(root, "webview-ui/src", p.slice(4)) : path.join(root, "webview-ui/src", /^(App\.tsx|browserMock\.ts)$/.test(p) ? "" : "office", p));

function patch(file, pairs) {
  let s = fs.readFileSync(src(file), "utf8").replace(/\r\n/g, "\n");
  for (const [from, to] of pairs) {
    const n = s.split(from).length - 1;
    if (n !== 1) throw new Error(`${file}: trecho casou ${n}x (esperado 1): ${from.slice(0, 60)}`);
    s = s.replace(from, () => to);
  }
  fs.writeFileSync(src(file), s);
}

// 1) tipos: assento de sala de estar e os dois assentos do personagem
patch("types.ts", [
  [
    `  assigned: boolean;
}`,
    `  assigned: boolean;
  /** Assento sem mesa a frente (sofa, banco): sala de estar. */
  lounge?: boolean;
}`,
  ],
  [
    `  seatId: string | null;`,
    `  seatId: string | null;
  /** Fabrica: assento do computador (trabalhando) e da sala de estar (sem demanda). seatId aponta para o atual. */
  deskSeatId?: string | null;
  loungeSeatId?: string | null;
  /** Fabrica: pausa recorrente (cafe, banheiro): assento da visita, quanto falta para voltar e quanto falta para a proxima. */
  visitSeatId?: string | null;
  visitTimer?: number;
  nextVisit?: number;
  /** Fabrica: chamado para a sala de reuniao pelo CEO (fica la ate a reuniao acabar, mesmo trabalhando). */
  inMeeting?: boolean;
  /** Fabrica: sinal sobre a cabeca: livre (verde), aguardando humano/agente (amarelo) ou ocupado (vermelho), e o balao de fala atual. */
  factoryStatus?: 'free' | 'waiting' | 'busy';
  factoryBubble?: { texto: string; ate: number } | null;
  /** Fabrica: de ferias (sem demanda ha mais de 1 semana): fica na espreguicadeira da piscina, a nao ser que seja chamado. */
  ferias?: boolean;
  poolSeatId?: string | null;`,
  ],
]);

// 2) assentos: marca os que nao tem mesa na frente
// (a mesa de centro da sala de estar tambem e "desk" no catalogo, entao o criterio e ter um PC na mesa a frente)
patch("layout/layoutSerializer.ts", [
  [
    `  const dirs: Array<{ dc: number; dr: number; facing: Direction }> = [`,
    `  const pcTiles = new Set<string>();
  for (const item of furniture) {
    if (!item.type.startsWith('PC')) continue;
    const entry = getCatalogEntry(item.type);
    for (let dr = 0; dr < (entry?.footprintH ?? 1); dr++) {
      for (let dc = 0; dc < (entry?.footprintW ?? 1); dc++) pcTiles.add((item.col + dc) + ',' + (item.row + dr));
    }
  }
  const worksAt = (col: number, row: number, facing: Direction): boolean => {
    const fc = col + (facing === Direction.LEFT ? -1 : facing === Direction.RIGHT ? 1 : 0);
    const fr = row + (facing === Direction.UP ? -1 : facing === Direction.DOWN ? 1 : 0);
    if (!deskTiles.has(fc + ',' + fr)) return false;
    return [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => pcTiles.has((fc + a) + ',' + (fr + b)));
  };

  const dirs: Array<{ dc: number; dr: number; facing: Direction }> = [`,
  ],
  [
    `          facingDir,
          assigned: false,
        });`,
    `          facingDir,
          assigned: false,
          lounge: !worksAt(tileCol, tileRow, facingDir),
        });`,
  ],
]);

// 3) estado: cada agente nasce descansando e troca de assento conforme trabalha
patch("engine/officeState.ts", [
  [
    `export class OfficeState {`,
    `import { HALL_START, ROOMS } from '../../factory/rooms.js';

export class OfficeState {`,
  ],
  [
    `  addAgent(
    id: number,`,
    `  /** Fabrica: assento livre. Sofa: o lazer mais perto da sala do time, espalhando entre as salas (cada ocupante pesa na escolha). Mesa: so na sala do proprio time. */
  private reachable: Set<string> | null = null;
  /** Fabrica: so vale assento ligado ao corredor por tiles livres (senao o personagem fica pulando no lugar). */
  private isReachable(col: number, row: number): boolean {
    if (!this.reachable) {
      const walk = new Set(this.walkableTiles.map((t) => t.col + ',' + t.row));
      for (const s of this.seats.values()) walk.add(s.seatCol + ',' + s.seatRow);
      const seen = new Set<string>();
      const fila = [HALL_START.col + ',' + HALL_START.row];
      while (fila.length > 0) {
        const k = fila.pop()!;
        if (seen.has(k) || !walk.has(k)) continue;
        seen.add(k);
        const [c, r] = k.split(',').map(Number);
        fila.push(c + 1 + ',' + r, c - 1 + ',' + r, c + ',' + (r + 1), c + ',' + (r - 1));
      }
      this.reachable = seen;
    }
    return this.reachable.has(col + ',' + row);
  }

  /** Fabrica: ao carregar a pagina o agente ja aparece no assento em que deveria estar (mesa se trabalha, sala de estar se descansa), sem correria. */
  factoryTeleport(id: number): void {
    const ch = this.characters.get(id);
    if (!ch || ch.isHuman || !ch.seatId) return;
    const seat = this.seats.get(ch.seatId);
    if (!seat) return;
    ch.tileCol = seat.seatCol;
    ch.tileRow = seat.seatRow;
    ch.x = seat.seatCol * TILE_SIZE + TILE_SIZE / 2;
    ch.y = seat.seatRow * TILE_SIZE + TILE_SIZE / 2;
    ch.path = [];
    ch.moveProgress = 0;
    ch.dir = seat.facingDir;
    ch.state = CharacterState.TYPE;
    ch.frame = 0;
    ch.frameTimer = 0;
    if (ch.matrixEffect === 'spawn') {
      ch.matrixEffect = null;
      ch.matrixEffectTimer = 0;
      ch.matrixEffectSeeds = [];
    }
  }

  /** Fabrica: pausas recorrentes. Quem esta descansando levanta de vez em quando e vai ao cafe ou ao banheiro, depois volta ao seu lugar. */
  private visitSeat(tipo: string): string | null {
    const roomOf = (col: number, row: number) =>
      ROOMS.find((r) => col >= r.x && col < r.x + r.w && row >= r.y && row < r.y + r.h);
    const livres: string[] = [];
    for (const [sid, s] of this.seats) {
      if (s.assigned || !this.isReachable(s.seatCol, s.seatRow)) continue;
      if (roomOf(s.seatCol, s.seatRow)?.type === tipo) livres.push(sid);
    }
    return livres.length > 0 ? livres[Math.floor(Math.random() * livres.length)] : null;
  }

  private factoryEndVisit(ch: Character): void {
    if (ch.visitSeatId) {
      const s = this.seats.get(ch.visitSeatId);
      if (s) s.assigned = false;
    }
    ch.visitSeatId = null;
    ch.inMeeting = false;
    ch.seatId = this.factoryHome(ch) ?? ch.seatId;
  }

  /** Fabrica: horario de folga (almoco 12h-14h e noite 19h-6h, hora de Sao Paulo): quem esta livre faz o que quiser. */
  private folga(): boolean {
    const teste = (globalThis as unknown as { __factoryFolga?: boolean }).__factoryFolga;
    if (typeof teste === 'boolean') return teste;
    const h = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' }).format(new Date()).slice(0, 2)) % 24;
    return (h >= 12 && h < 14) || h >= 19 || h < 6;
  }

  /** Fabrica: onde o agente fica quando nao esta em reuniao: na mesa (trabalhando, aguardando ou em expediente), no lazer se esta livre na folga. */
  private factoryHome(ch: Character): string | null {
    if (ch.visitSeatId) return ch.visitSeatId;
    if ((ch.factoryStatus ?? 'free') === 'free' && ch.ferias && ch.poolSeatId) return ch.poolSeatId;
    if ((ch.factoryStatus ?? 'free') === 'free' && this.folga() && ch.loungeSeatId) return ch.loungeSeatId;
    return ch.deskSeatId ?? ch.loungeSeatId ?? null;
  }

  /** Fabrica: ferias. Liga: reserva uma espreguicadeira na piscina. Desliga (voltou a ter demanda): solta a espreguicadeira. */
  factoryFerias(id: number, on: boolean): void {
    const ch = this.characters.get(id);
    if (!ch || ch.isHuman || !ch.loungeSeatId || !!ch.ferias === on) return;
    if (on) {
      const alvo = this.visitSeat('pool');
      if (!alvo) return;
      this.seats.get(alvo)!.assigned = true;
      ch.poolSeatId = alvo;
      ch.ferias = true;
    } else {
      const s = ch.poolSeatId ? this.seats.get(ch.poolSeatId) : undefined;
      if (s) s.assigned = false;
      ch.poolSeatId = null;
      ch.ferias = false;
    }
    if (!ch.inMeeting && !ch.visitSeatId) ch.seatId = this.factoryHome(ch) ?? ch.seatId;
  }

  /** Fabrica: estado do agente (verde livre, amarelo aguardando, vermelho ocupado) e o balao de fala da mudanca. */
  factoryStatus(id: number, st: 'free' | 'waiting' | 'busy', motivo: 'humano' | 'agente' = 'humano'): void {
    const ch = this.characters.get(id);
    if (!ch || ch.isHuman) return;
    const antes = ch.factoryStatus ?? 'free';
    ch.factoryStatus = st;
    if (st === antes) return;
    const agora = Date.now();
    if (st === 'busy') ch.factoryBubble = { texto: 'Começando…', ate: agora + 4000 };
    else if (st === 'free') ch.factoryBubble = antes === 'busy' ? { texto: 'Pronto ✓', ate: agora + 6000 } : null;
    else ch.factoryBubble = { texto: motivo === 'agente' ? 'Aguardando agente' : 'Aguardando você', ate: 0 };
  }

  /** Fabrica: reuniao. Chama os agentes do squad para a sala de reuniao (null encerra e todos voltam ao lugar). Idempotente: agentes que chegam depois tambem sao chamados. */
  factoryMeeting(game: string | null): void {
    for (const ch of this.characters.values()) {
      if (ch.isHuman || !ch.loungeSeatId) continue;
      if (ch.inMeeting && ch.directoryName !== game) this.factoryEndVisit(ch);
      if (!game || ch.inMeeting || ch.directoryName !== game) continue;
      if (ch.visitSeatId) this.factoryEndVisit(ch);
      const alvo = this.visitSeat('meeting');
      if (!alvo) continue;
      this.seats.get(alvo)!.assigned = true;
      ch.visitSeatId = alvo;
      ch.inMeeting = true;
      ch.seatId = alvo;
    }
  }

  private factoryVisits(dt: number): void {
    const folga = this.folga();
    for (const ch of this.characters.values()) {
      if (ch.isHuman || !ch.loungeSeatId) continue;
      if (ch.factoryBubble && ch.factoryBubble.ate > 0 && Date.now() > ch.factoryBubble.ate) ch.factoryBubble = null;
      if (ch.inMeeting) continue;
      const livre = (ch.factoryStatus ?? 'free') === 'free';
      if (ch.visitSeatId) {
        ch.visitTimer = (ch.visitTimer ?? 0) - dt;
        if (ch.visitTimer <= 0 || !livre) this.factoryEndVisit(ch);
        continue;
      }
      // a mesa e o lugar do agente; na folga (almoco, noite) o livre vai para o lazer, e volta quando acaba ou quando e chamado
      const casa = this.factoryHome(ch);
      if (casa && ch.seatId !== casa) {
        ch.seatId = casa;
        continue;
      }
      if (!livre) continue;
      const seat = casa ? this.seats.get(casa) : undefined;
      if (!seat || ch.tileCol !== seat.seatCol || ch.tileRow !== seat.seatRow) continue;
      ch.nextVisit = (ch.nextVisit ?? 30 + Math.random() * 120) - dt;
      if (ch.nextVisit > 0) continue;
      ch.nextVisit = folga ? 40 + Math.random() * 80 : 100 + Math.random() * 160;
      const r = Math.random();
      const tipo = folga ? (r < 0.5 ? 'lounge' : r < 0.85 ? 'cafe' : 'wc') : r < 0.3 ? 'wc' : 'cafe';
      const alvo = this.visitSeat(tipo);
      if (!alvo) continue;
      this.seats.get(alvo)!.assigned = true;
      ch.visitSeatId = alvo;
      ch.visitTimer = tipo === 'wc' ? 14 + Math.random() * 8 : tipo === 'cafe' ? 28 + Math.random() * 20 : 45 + Math.random() * 75;
      ch.seatId = alvo;
    }
  }

  private pickSeat(lounge: boolean, game?: string): string | null {
    const home = game ? ROOMS.find((r) => r.id === game) : undefined;
    const roomOf = (col: number, row: number) =>
      ROOMS.find((r) => col >= r.x && col < r.x + r.w && row >= r.y && row < r.y + r.h);
    const ocupantes = new Map<string, number>();
    if (lounge) {
      for (const s of this.seats.values()) {
        if (!s.assigned || !s.lounge) continue;
        const r = roomOf(s.seatCol, s.seatRow);
        if (r) ocupantes.set(r.id, (ocupantes.get(r.id) ?? 0) + 1);
      }
    }
    let best: string | null = null;
    let bestScore = Infinity;
    for (const [sid, s] of this.seats) {
      if (s.assigned || !!s.lounge !== lounge || !this.isReachable(s.seatCol, s.seatRow)) continue;
      const room = roomOf(s.seatCol, s.seatRow);
      if (lounge ? room?.type !== 'lounge' : !home || room?.id !== home.id) continue;
      const d = home ? Math.abs(s.seatCol - (home.x + 4)) + Math.abs(s.seatRow - (home.y + 5)) : 0;
      const score = d + (room ? (ocupantes.get(room.id) ?? 0) * 9 : 0) + Math.random() * 4;
      if (score < bestScore) {
        bestScore = score;
        best = sid;
      }
    }
    return best;
  }

  addAgent(
    id: number,`,
  ],
  [
    `    const toDelete: number[] = [];
    for (const ch of this.characters.values()) {
      const effect = advanceMatrixEffect(ch, dt);`,
    `    this.factoryVisits(dt);
    const toDelete: number[] = [];
    for (const ch of this.characters.values()) {
      const effect = advanceMatrixEffect(ch, dt);`,
  ],
  [
    `    let ch: Character;
    if (seatId) {
      const seat = this.seats.get(seatId)!;`,
    `    let ch: Character;
    const loungeId = this.pickSeat(true, directoryName);
    if (loungeId) {
      const loungeSeat = this.seats.get(loungeId)!;
      loungeSeat.assigned = true;
      const deskId = this.pickSeat(false, directoryName);
      const deskSeat = deskId ? this.seats.get(deskId)! : null;
      if (deskSeat) deskSeat.assigned = true;
      ch = createCharacter(id, palette, deskId ?? loungeId, deskSeat ?? loungeSeat, hueShift);
      ch.loungeSeatId = loungeId; // lugar de folga (fixo)
      ch.deskSeatId = deskId; // a mesa e do agente, sempre: ele fica nela
      ch.isActive = false;
      ch.factoryStatus = 'free';
    } else if (seatId) {
      const seat = this.seats.get(seatId)!;`,
  ],
  [
    `      ch.isActive = active;
      if (!active) {`,
    `      ch.isActive = active;
      if (ch.loungeSeatId) {
        if (ch.visitSeatId && !ch.inMeeting) this.factoryEndVisit(ch);
        ch.seatId = this.factoryHome(ch);
      }
      if (!active) {`,
  ],
]);

// 4) movimento: sem demanda vai e fica sentado no sofa (pose parada); com demanda vai para o computador
patch("engine/characters.ts", [
  [
    `            if (newPath.length > 0) {
              ch.path = newPath;
              ch.moveProgress = 0;
            }`,
    `            // Fabrica: so troca a rota se ela termina mesmo no assento (senao reiniciava o passo a cada quadro e o personagem pulava no lugar)
            const fim = newPath[newPath.length - 1];
            if (fim && fim.col === seat.seatCol && fim.row === seat.seatRow) {
              ch.path = newPath;
              ch.moveProgress = 0;
            }`,
  ],
  [
    `    case CharacterState.TYPE: {
      if (ch.frameTimer >= TYPE_FRAME_DURATION_SEC) {`,
    `    case CharacterState.TYPE: {
      // Fabrica: demandado enquanto sentado em outro assento (sofa): levanta e vai para o computador.
      if (ch.isActive && ch.seatId) {
        const alvo = seats.get(ch.seatId);
        if (alvo && (ch.tileCol !== alvo.seatCol || ch.tileRow !== alvo.seatRow)) {
          ch.state = CharacterState.IDLE;
          ch.frame = 0;
          ch.frameTimer = 0;
          break;
        }
      }
      if (ch.isActive && ch.frameTimer >= TYPE_FRAME_DURATION_SEC) {`,
  ],
  [
    `      if (!ch.isActive) {
        if (ch.seatTimer > 0) {`,
    `      if (!ch.isActive) {
        // Fabrica: sentado na sala de estar, fica ali (sem animar de digitar).
        const sofa = ch.seatId && (ch.seatId === ch.loungeSeatId || ch.seatId === ch.visitSeatId || ch.seatId === ch.deskSeatId) ? seats.get(ch.seatId) : undefined;
        if (sofa && ch.tileCol === sofa.seatCol && ch.tileRow === sofa.seatRow) {
          ch.dir = sofa.facingDir;
          ch.frame = 0;
          break;
        }
        if (ch.seatTimer > 0) {`,
  ],
  [
    `      // Countdown wander timer
      ch.wanderTimer -= dt;`,
    `      // Fabrica: sem demanda, vai direto para o assento da sala de estar em vez de vagar.
      if (ch.seatId && (ch.seatId === ch.loungeSeatId || ch.seatId === ch.visitSeatId || ch.seatId === ch.deskSeatId)) {
        const sofa = seats.get(ch.seatId);
        if (sofa) {
          const path = findPath(ch.tileCol, ch.tileRow, sofa.seatCol, sofa.seatRow, tileMap, blockedTiles);
          if (path.length > 0) {
            ch.path = path;
            ch.moveProgress = 0;
            ch.state = CharacterState.WALK;
          } else {
            ch.state = CharacterState.TYPE;
            ch.dir = sofa.facingDir;
          }
          ch.frame = 0;
          ch.frameTimer = 0;
          break;
        }
      }
      // Countdown wander timer
      ch.wanderTimer -= dt;`,
  ],
]);

// 4b) clicar no agente mostra as issues dele (painel da fabrica)
patch("components/ToolOverlay.tsx", [
  [
    `import { overlayProjection } from '../projection.js';`,
    `import { FactoryIssues } from '../../factory/FactoryIssues.js';
import { registry } from '../../factory/registry.js';
import { overlayProjection } from '../projection.js';`,
  ],
  [
    `  TEAM_LEAD_COLOR,
  TEAM_ROLE_COLOR,
`,
    ``,
  ],
  [
    `                        fontSize: '18px',
                        color: ch.isTeamLead ? TEAM_LEAD_COLOR : TEAM_ROLE_COLOR,
                        fontWeight: ch.isTeamLead ? 'bold' : undefined,`,
    `                        fontSize: '24px',
                        color: '#FFC95C',
                        fontWeight: 'bold',`,
  ],
  [
    `                      {ch.directoryName}
                    </span>`,
    `                      {registry.squad(ch.directoryName) || ch.directoryName}
                    </span>`,
  ],
  [
    `              {showContextGauge && (
                <div`,
    `              {isSelected && !isSub && <FactoryIssues game={ch.directoryName} label={ch.agentName} />}
              {showContextGauge && (
                <div`,
  ],
]);

// 4b2) estado do agente (verde, amarelo, vermelho) vem do transporte; o balao de fala e o sinal ficam no ToolOverlay
patch("src:hooks/useExtensionMessages.ts", [
  [
    `        os.setAgentActive(id, status === 'active');
        if (status === 'waiting') {`,
    `        os.factoryStatus(id, status === 'active' ? (msg.waitingAgent === true ? 'waiting' : 'busy') : msg.awaitingInput === true ? 'waiting' : 'free', msg.waitingAgent === true ? 'agente' : 'humano');
        os.setAgentActive(id, status === 'active');
        if (status === 'waiting') {`,
  ],
]);
patch("components/ToolOverlay.tsx", [
  [`        if (ch.bubbleType && !(ch.bubbleType === 'waiting' && ch.waitingAwaitingInput)) {`, `        if (isSub && ch.bubbleType &&!(ch.bubbleType === 'waiting' && ch.waitingAwaitingInput)) {`],
  [
    `        // Only show the label for hovered or selected agents (unless`,
    `        // Fabrica: pontinho de estado sobre a cabeca (verde livre, amarelo aguardando, vermelho ocupado) e balao de fala da mudanca
        let estadoNode = null;
        if (!ch.isHuman && !isSub) {
          const st = ch.factoryStatus ?? 'free';
          const cor = st === 'busy' ? '#EB5757' : st === 'waiting' ? '#F2C94C' : '#6FCF97';
          const sentado = ch.state === CharacterState.TYPE ? CHARACTER_SITTING_OFFSET_PX : 0;
          const topo = project.toScreenY(ch.y + sentado - 34) - 13;
          const fb = ch.factoryBubble;
          estadoNode = fb ? (
            <div
              className="absolute -translate-x-1/2 pointer-events-none"
              style={{ left: project.toScreenX(ch.x), top: topo - 26, whiteSpace: 'nowrap', padding: '2px 6px', background: '#0F1318', color: '#EEF1F6', border: '1px solid ' + cor, font: "11px ui-monospace,Consolas,monospace", zIndex: OVERLAY_BUBBLE_Z_INDEX }}
            >
              {fb.texto}
            </div>
          ) : null;
        }

        // Only show the label for hovered or selected agents (unless`,
  ],
  [`          return bubbleNode && <Fragment key={id}>{bubbleNode}</Fragment>;`, `          return <Fragment key={id}>{bubbleNode}{estadoNode}</Fragment>;`],
  [
    `              {bubbleNode}
              <div
                className="absolute"`,
    `              {bubbleNode}
              {estadoNode}
              <div
                className="absolute"`,
  ],
]);

// 4c) o nome do squad escrito no chao (areas) fica sempre visivel, sem depender da configuracao de cada usuario
patch("App.tsx", [
  [`const effectiveShowAreas = isEditingAreas || showAreas;`, `const effectiveShowAreas = isEditingAreas || showAreas || true;`],
]);

// 4d) layout e catalogos buscados com numero de versao da publicacao: o navegador nao reaproveita copia velha (GitHub Pages guarda 10 min)
const stamp = Date.now();
patch("browserMock.ts", [
  ["fetch(`${base}assets/asset-index.json`)", "fetch(`${base}assets/asset-index.json?v=" + stamp + "`)"],
  ["fetch(`${base}assets/furniture-catalog.json`)", "fetch(`${base}assets/furniture-catalog.json?v=" + stamp + "`)"],
  ["fetch(`${base}assets/${assetIndex.defaultLayout}`)", "fetch(`${base}assets/${assetIndex.defaultLayout}?v=" + stamp + "`)"],
]);

// 4d1) os PNGs de personagens, pisos, paredes e moveis eram baixados um de cada vez (cada um esperava o anterior): em paralelo, o cenario aparece em poucos segundos
patch("browserMock.ts", [
  [
    `  const sprites: CharacterDirectionSprites[] = [];
  for (const relPath of index.characters) {`,
    `  const sprites: CharacterDirectionSprites[] = [];
  const pngs = await Promise.all(index.characters.map((relPath) => decodePng(\`\${base}assets/\${getIndexedAssetPath('characters', relPath)}\`)));
  for (const png of pngs) {`,
  ],
  [
    `    const png = await decodePng(\`\${base}assets/\${getIndexedAssetPath('characters', relPath)}\`);
    const byDir`,
    `    const byDir`,
  ],
  [
    `  for (const relPath of index.floors) {
    const png = await decodePng(\`\${base}assets/\${getIndexedAssetPath('floors', relPath)}\`);`,
    `  const pngsF = await Promise.all(index.floors.map((relPath) => decodePng(\`\${base}assets/\${getIndexedAssetPath('floors', relPath)}\`)));
  for (const png of pngsF) {`,
  ],
  [
    `  for (const relPath of index.walls) {
    const png = await decodePng(\`\${base}assets/\${getIndexedAssetPath('walls', relPath)}\`);`,
    `  const pngsW = await Promise.all(index.walls.map((relPath) => decodePng(\`\${base}assets/\${getIndexedAssetPath('walls', relPath)}\`)));
  for (const png of pngsW) {`,
  ],
  [
    `  for (const entry of catalog) {
    const png = await decodePng(\`\${base}assets/\${entry.furniturePath}\`);
    sprites[entry.id] = readSprite(png, entry.width, entry.height);
  }`,
    `  const pngsM = await Promise.all(catalog.map((entry) => decodePng(\`\${base}assets/\${entry.furniturePath}\`)));
  catalog.forEach((entry, i) => {
    sprites[entry.id] = readSprite(pngsM[i], entry.width, entry.height);
  });`,
  ],
]);

// 4d2) layout salvo pelo CEO (tabela factory_layout) vale no lugar do padrao gerado
patch("browserMock.ts", [
  [
    `import { rgbaToHex } from '../../core/src/assets/colorUtils.ts';`,
    `import { rgbaToHex } from '../../core/src/assets/colorUtils.ts';
import { layoutSalvo } from './factory/layoutStore.js';`,
  ],
  [`  const layout = assetIndex.defaultLayout
`, `  const layout = await layoutSalvo(assetIndex.defaultLayout
`],
  [`    : null;

  // Carpets only have`, `    : null);

  // Carpets only have`],
]);

// 4e) lista lateral de agentes agrupada por squad, com o nome de cada um
patch("src:components/AgentCardBar.tsx", [
  [
    `import { cardVariant } from './cardBar.js';`,
    `import { CardGroups } from '../factory/CardGroups.js';
import { cardVariant } from './cardBar.js';`,
  ],
  [
    `      {agentIds.map((agentId) => (
        <AgentCard
          key={agentId}
          agentId={agentId}
          variant={cardVariant(agentId, { activeId: activeAgentId, focusedId: focusedAgentId })}
          appearance={getAppearance(agentId)}
          status={statusFor(agentId)}
          onSelect={onSelect}
          onClose={onClose}
        />
      ))}`,
    `      <CardGroups
        agentIds={agentIds}
        render={(agentId) => (
          <AgentCard
            agentId={agentId}
            variant={cardVariant(agentId, { activeId: activeAgentId, focusedId: focusedAgentId })}
            appearance={getAppearance(agentId)}
            status={statusFor(agentId)}
            onSelect={onSelect}
            onClose={onClose}
          />
        )}
      />`,
  ],
]);

// 4f) zoom inicial que mostra o mapa inteiro (inteiro, para o pixel art ficar nitido)
patch("src:hooks/useEditorActions.ts", [
  [
    `  return Math.max(ZOOM_MIN, Math.round(ZOOM_DEFAULT_DPR_FACTOR * dpr));`,
    `  const cabe = Math.floor(
    Math.min((window.innerWidth * dpr) / (MAP_COLS * 16), (window.innerHeight * dpr) / (MAP_ROWS * 16)),
  );
  return Math.max(ZOOM_MIN, Math.min(Math.round(ZOOM_DEFAULT_DPR_FACTOR * dpr), cabe));`,
  ],
  [
    `import { useCallback, useRef, useState } from 'react';`,
    `import { useCallback, useEffect, useRef, useState } from 'react';`,
  ],
  [
    `  const [zoom, setZoom] = useState(defaultZoom);`,
    `  const [zoom, setZoom] = useState(defaultZoom);
  // O tamanho da janela pode ainda nao estar certo ao carregar: recalcula o zoom de encaixe depois, se o usuario nao mexeu.
  useEffect(() => {
    const ts = [700, 2500].map((ms) =>
      setTimeout(() => {
        if (!(window as unknown as { __zoomTouched?: boolean }).__zoomTouched) setZoom(defaultZoom());
      }, ms),
    );
    return () => ts.forEach(clearTimeout);
  }, []);`,
  ],
  [
    `    setZoom(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom)));
  }, []);`,
    `    (window as unknown as { __zoomTouched?: boolean }).__zoomTouched = true;
    setZoom(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom)));
  }, []);`,
  ],
  [
    `function defaultZoom(): number {`,
    `import { MAP_COLS, MAP_ROWS } from '../factory/rooms.js';

function defaultZoom(): number {`,
  ],
]);

// 4g) avatares humanos (CEO e visitantes): andam por clique/teclado, sentam em qualquer assento livre e nunca vagam sozinhos
patch("types.ts", [
  [
    `  deskSeatId?: string | null;`,
    `  deskSeatId?: string | null;
  /** Fabrica: pessoa (CEO ou visitante), nao agente. */
  isHuman?: boolean;
  humanName?: string;
  humanKind?: 'ceo' | 'visitor' | 'recep';`,
  ],
]);
patch("engine/officeState.ts", [
  [
    `  addAgent(
    id: number,`,
    `  /** Fabrica: pessoa no escritorio. Com seatId nasce sentada; sem, de pe em (col,row). */
  addHuman(
    id: number,
    palette: number,
    hueShift: number,
    seatId: string | null,
    name: string,
    kind: 'ceo' | 'visitor' | 'recep',
    col = 1,
    row = 1,
  ): void {
    if (this.characters.has(id)) return;
    const seat = seatId ? this.seats.get(seatId) : undefined;
    const ch = createCharacter(id, palette, seat ? seatId : null, seat ?? null, hueShift);
    if (seat) {
      seat.assigned = true;
      ch.loungeSeatId = seatId;
    } else {
      ch.tileCol = col;
      ch.tileRow = row;
      ch.x = col * TILE_SIZE + TILE_SIZE / 2;
      ch.y = row * TILE_SIZE + TILE_SIZE / 2;
      ch.state = CharacterState.IDLE;
    }
    ch.isActive = false;
    ch.isHuman = true;
    ch.humanName = name;
    ch.humanKind = kind;
    this.characters.set(id, ch);
  }

  /** Fabrica: manda a pessoa para o tile; se for um assento livre, ela senta. Devolve false se nao deu. */
  humanGoTo(id: number, col: number, row: number): boolean {
    const ch = this.characters.get(id);
    if (!ch || !ch.isHuman) return false;
    let target: string | null = null;
    for (const [sid, s] of this.seats) if (s.seatCol === col && s.seatRow === row) target = sid;
    const targetKey = col + ',' + row;
    if (target) {
      if (this.seats.get(target)!.assigned && target !== ch.seatId) return false;
    } else if (!isWalkable(col, row, this.tileMap, this.blockedTiles)) {
      return false;
    }
    const abrir = [this.ownSeatKey(ch), target ? targetKey : null].filter((k): k is string => !!k && this.blockedTiles.has(k));
    for (const k of abrir) this.blockedTiles.delete(k);
    const path = findPath(ch.tileCol, ch.tileRow, col, row, this.tileMap, this.blockedTiles);
    for (const k of abrir) this.blockedTiles.add(k);
    if (path.length === 0) return false;
    if (ch.seatId && ch.seatId !== target) {
      const old = this.seats.get(ch.seatId);
      if (old) old.assigned = false;
    }
    ch.seatId = target;
    ch.loungeSeatId = target;
    if (target) this.seats.get(target)!.assigned = true;
    ch.path = path;
    ch.moveProgress = 0;
    ch.state = CharacterState.WALK;
    ch.frame = 0;
    ch.frameTimer = 0;
    return true;
  }

  addAgent(
    id: number,`,
  ],
  [
    `      // Skip characters that are despawning
      if (ch.matrixEffect === 'despawn') continue;`,
    `      // Skip characters that are despawning
      if (ch.matrixEffect === 'despawn') continue;
      if (ch.isHuman) continue; // pessoa nao e agente: clicar nela vira clique no chao`,
  ],
]);
patch("engine/characters.ts", [
  [
    `      ch.moveProgress += (WALK_SPEED_PX_PER_SEC / TILE_SIZE) * dt;`,
    `      // Fabrica: agente chamado para o trabalho anda mais depressa (a sala do time pode ficar do outro lado do mapa)
      ch.moveProgress += ((WALK_SPEED_PX_PER_SEC * (ch.isActive && !ch.isHuman ? 2.5 : 1)) / TILE_SIZE) * dt;`,
  ],
  [
    `      if (ch.seatTimer < 0) ch.seatTimer = 0; // clear turn-end sentinel`,
    `      if (ch.seatTimer < 0) ch.seatTimer = 0; // clear turn-end sentinel
      if (ch.isHuman) break; // pessoa so anda por comando`,
  ],
]);
patch("components/OfficeCanvas.tsx", [
  [
    `        zoomAccumulatorRef.current += e.deltaY;
        if (Math.abs(zoomAccumulatorRef.current) >= ZOOM_SCROLL_THRESHOLD) {
          const delta = zoomAccumulatorRef.current < 0 ? 1 : -1;
          zoomAccumulatorRef.current = 0;
          const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom + delta));
          if (newZoom !== zoom) {
            onZoomChange(newZoom);
          }
        }`,
    `        // Fabrica: zoom gradual (passos de 0,25), em vez de um nivel inteiro por clique da roda.
        zoomAccumulatorRef.current += e.deltaY;
        const passos = Math.trunc(Math.abs(zoomAccumulatorRef.current) / (ZOOM_SCROLL_THRESHOLD * 2));
        if (passos > 0) {
          const delta = (zoomAccumulatorRef.current < 0 ? 0.25 : -0.25) * passos;
          zoomAccumulatorRef.current = 0;
          const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round((zoom + delta) * 4) / 4));
          if (newZoom !== zoom) {
            onZoomChange(newZoom);
          }
        }`,
  ],
  [
    `      // Pet hit: toggle the heart bubble.`,
    `      // Fabrica: clique no chao manda a pessoa (CEO ou visitante) andar para la.
      const tileClick = (window as unknown as { __factoryTileClick?: (c: number, r: number) => boolean }).__factoryTileClick;
      if (tileClick) {
        const t = screenToTile(clientX, clientY);
        if (t && tileClick(t.col, t.row)) return;
      }

      // Pet hit: toggle the heart bubble.`,
  ],
]);
patch("App.tsx", [
  [
    `import { ToolOverlay } from './office/components/ToolOverlay.js';`,
    `import { HumanLayer } from './factory/HumanLayer.js';
import { isOwner } from './factory/session.js';
import { ToolOverlay } from './office/components/ToolOverlay.js';`,
  ],
  [
    `          <ToolOverlay
            officeState={officeState}`,
    `          <HumanLayer officeState={officeState} containerRef={containerRef} zoom={editor.zoom} panRef={editor.panRef} />

          <ToolOverlay
            officeState={officeState}`,
  ],
  // so o CEO edita o mapa: visitante nao ve a barra de ferramentas
  [`{!isMobile && !officeReadOnly && (
        <BottomToolbar`, `{!isMobile && !officeReadOnly && isOwner() && (
        <BottomToolbar`],
]);

// 4h) zoom fracionado sem quadriculado: cada pixel do sprite cobre as bordas arredondadas (sem frestas entre eles)
patch("sprites/spriteCache.ts", [
  [
    `  canvas.width = cols * zoom;
  canvas.height = rows * zoom;`,
    `  canvas.width = Math.round(cols * zoom);
  canvas.height = Math.round(rows * zoom);`,
  ],
  [
    `      ctx.fillRect(c * zoom, r * zoom, zoom, zoom);`,
    `      const x0 = Math.round(c * zoom);
      const y0 = Math.round(r * zoom);
      ctx.fillRect(x0, y0, Math.round((c + 1) * zoom) - x0, Math.round((r + 1) * zoom) - y0);`,
  ],
]);

// 5) layout: mapa grande gerado por layout.mjs (10 salas) + lista de salas para escolher mesa e sofa de cada agente
const layoutFile = path.join(root, "webview-ui/public/assets/default-layout-1.json");
const { layout, rooms, hall } = buildLayout();
fs.writeFileSync(layoutFile, JSON.stringify(layout));
fs.writeFileSync(
  path.join(root, "webview-ui/src/factory/rooms.ts"),
  ["// gerado por portal/layout.mjs", "export const HALL_START = { col: " + hall.col + ", row: " + hall.row + " };", "export const MAP_COLS = " + layout.cols + ";", "export const MAP_ROWS = " + layout.rows + ";", "export const ROOMS: { id: string; type: string; label: string; x: number; y: number; w: number; h: number; spawn?: { col: number; row: number }; seat?: { col: number; row: number } }[] = " + JSON.stringify(rooms) + ";", ""].join(String.fromCharCode(10)),
);

console.log("patches da fabrica aplicados");
