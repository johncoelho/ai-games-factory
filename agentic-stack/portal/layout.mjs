// Gera o mapa do escritorio da fabrica: 12 salas em 2 fileiras, ligadas por um corredor.
// Fileira de cima: 4 salas de time (Naval Battle, Agentic Stack, Domínio/Monopoly, Marketing), sala de reuniao e cafe.
// Fileira de baixo: sala de TV, recepcao, sala do CEO, bar e sinuca, sala de jogos e banheiro.
// Devolve o layout do Pixel Agents e a lista de salas (usada para escolher mesa e sofa de cada agente).

const VOID = 255;
const WALL = 0;

const WOOD = { tile: 7, color: { h: 25, s: 48, b: -43, c: -88 } };
const BLUE = { tile: 1, color: { h: 209, s: 39, b: -25, c: -80 } };
const HALL = { tile: 3, color: { h: 215, s: 18, b: -38, c: -55 } };
const MARBLE = { tile: 2, color: { h: 35, s: 18, b: -22, c: -45 } };
const CARPET = { tile: 1, color: { h: 232, s: 38, b: -55, c: -62 } };
const ARCADE_FLOOR = { tile: 1, color: { h: 272, s: 36, b: -50, c: -66 } };
const TILE_WC = { tile: 2, color: { h: 190, s: 22, b: -10, c: -40 } };
const GRASS = { tile: 1, color: { h: 125, s: 38, b: -48, c: -62 } };
const DECK = { tile: 7, color: { h: 30, s: 45, b: -25, c: -70 } };
const CEO_FLOOR ={ tile: 6, color: { h: 18, s: 55, b: -62, c: -75 } };

export const SQUADS_MAPA = [
  { slug: 'naval-battle', label: 'SQUAD BATALHA NAVAL' },
  { slug: 'agentic-stack', label: 'AGENTIC STACK TEAM' },
  { slug: 'dominiogame', label: 'SQUAD DOMÍNIO' },
  { slug: 'marketing-squad', label: 'SQUAD MARKETING' },
];

export function buildLayout() {
  const COLS = 73; // 6 salas de 9 + 7 paredes + 12 da area externa (piscina)
  const ROWS = 29;
  const TOP = 3; // primeira linha de piso da fileira de cima
  const H = 10; // altura do piso das salas
  const BOT = 18; // primeira linha de piso da fileira de baixo
  const HALL_Y = 13; // corredor: linhas 13 a 15, aberto para as salas de cima
  const tiles = new Array(COLS * ROWS).fill(VOID);
  const colors = new Array(COLS * ROWS).fill(null);
  const areaTiles = new Array(COLS * ROWS).fill(null);
  const areas = [];
  const furniture = [];
  const rooms = [];
  const at = (c, r) => r * COLS + c;

  const floor = (c0, r0, w, h, f) => {
    for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) {
      tiles[at(c, r)] = f.tile;
      colors[at(c, r)] = f.color;
    }
  };
  const add = (type, col, row) => furniture.push({ uid: `f-${furniture.length}`, type, col, row });
  const area = (label, color, c0, r, w) => {
    if (!areas.find((a) => a.label === label)) areas.push({ label, color });
    for (let c = c0; c < c0 + w; c++) areaTiles[at(c, r)] = label;
  };

  // pisos
  const colX = (i) => 1 + 10 * i;
  for (let i = 0; i < 6; i++) {
    floor(colX(i), TOP, 9, H, i === 4 ? BLUE : i === 5 ? MARBLE : WOOD); // fileira de cima (reuniao e cafe nas duas ultimas)
  }
  floor(colX(0), BOT, 9, H, CARPET); // sala de TV
  floor(colX(1), BOT, 9, H, MARBLE); // recepcao
  floor(colX(2), BOT, 9, H, CEO_FLOOR); // CEO
  floor(colX(3), BOT, 9, H, CEO_FLOOR); // bar e sinuca
  floor(colX(4), BOT, 9, H, ARCADE_FLOOR); // jogos
  floor(colX(5), BOT, 9, H, TILE_WC); // banheiro
  floor(1, HALL_Y, 60, 3, HALL); // corredor (a ultima coluna e a porta para a area externa)
  // area externa: piscina, com gramado em volta e deck de madeira
  const PX = 61, PY = 8;
  floor(PX, PY, 11, 14, GRASS);
  floor(PX + 1, PY + 2, 9, 11, DECK);

  // portas da fileira de baixo: 3 tiles de largura atravessando o vazio (linha 16) e a parede (linha 17)
  for (let i = 0; i < 6; i++) {
    const x = colX(i) + 3;
    for (let c = x; c < x + 3; c++) for (const r of [16, 17]) {
      tiles[at(c, r)] = HALL.tile;
      colors[at(c, r)] = HALL.color;
    }
  }

  // paredes (como no layout original): parede em cima de cada piso e dos lados; a borda de baixo fica aberta
  const isFloor = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS && tiles[at(c, r)] !== VOID && tiles[at(c, r)] !== WALL;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (tiles[at(c, r)] !== VOID) continue;
    if (isFloor(c, r + 1) || isFloor(c - 1, r) || isFloor(c + 1, r) || isFloor(c - 1, r + 1) || isFloor(c + 1, r + 1)) tiles[at(c, r)] = WALL;
  }

  // ---- modelos de sala (posicoes relativas ao canto do piso) ----
  const team = (i, slug, label) => {
    const x = colX(i), y = TOP;
    const p = (type, dx, dy) => add(type, x + dx, y + dy);
    p('HANGING_PLANT', 0, -2); p('DOUBLE_BOOKSHELF', 1, -2); p('GOLD_FRAME_TEAL', 3, -2); p('CLOCK', 4, -2); p('GOLD_FRAME_TEAL', 5, -2); p('DOUBLE_BOOKSHELF', 6, -2); p('HANGING_PLANT', 8, -2);
    p('CACTUS', 8, 6); p('PLANT', 8, 8); p('CACTUS', 4, 9);
    for (const dx of [1, 3, 5, 7]) { p('DESK_FRONT', dx, 1); p('PC_FRONT_OFF', dx + 1, 1); p('CUSHIONED_BENCH', dx + 1, 3); }
    p('TABLE_FRONT', 3, 5);
    p('WOODEN_CHAIR_SIDE', 2, 5); p('WOODEN_CHAIR_SIDE', 2, 7); p('WOODEN_CHAIR_SIDE:left', 6, 5); p('WOODEN_CHAIR_SIDE:left', 6, 7);
    p('PC_SIDE', 3, 5); p('PC_SIDE', 3, 7); p('PC_SIDE:left', 5, 5); p('PC_SIDE:left', 5, 7);
    p('SMALL_TABLE_SIDE', 0, 7); p('COFFEE', 0, 8); p('PLANT_2', 0, 6); p('BIN', 1, 9);
    area(label, '#FFC95C', x + 1, y + 4, 7);
    rooms.push({ id: slug, type: 'team', label, x, y, w: 9, h: H });
  };
  // sala de TV: muitos sofas virados para a TV, no fundo da sala (a porta fica em cima)
  const salaTV = (col, row, id, label) => {
    const x = colX(col), y = row;
    const p = (type, dx, dy) => add(type, x + dx, y + dy);
    p('SMALL_PAINTING', 1, -2); p('SMALL_PAINTING_2', 2, -2); p('LARGE_PAINTING', 6, -2);
    p('PLANT_2', 0, -1); p('PLANT', 8, -1);
    for (const dy of [2, 5]) for (const dx of [0, 2, 5, 7]) p('SOFA_FRONT', dx, dy);
    p('TV_STAND', 3, 8);
    p('COFFEE_TABLE', 0, 7); p('POT', 8, 8);
    area(label, '#7AD1E0', x + 1, y + 4, 7);
    rooms.push({ id, type: 'lounge', label, x, y, w: 9, h: H });
  };
  // bar e sinuca
  const salaBar = (col, row, id, label) => {
    const x = colX(col), y = row;
    const p = (type, dx, dy) => add(type, x + dx, y + dy);
    p('BAR_SHELF', 0, -2); p('BAR_SHELF', 6, -2); p('MIRROR', 2, -2); p('GOLD_FRAME_ORANGE', 8, -2);
    p('BAR_COUNTER', 0, 2);
    for (const dx of [0, 1, 2]) p('WOODEN_BENCH', dx, 4);
    p('POOL_TABLE', 4, 5);
    p('WOODEN_BENCH', 3, 5); p('WOODEN_BENCH', 3, 6); p('WOODEN_BENCH', 7, 5); p('WOODEN_BENCH', 7, 6);
    p('WOODEN_BENCH', 5, 4); p('WOODEN_BENCH', 5, 7);
    p('SOFA_FRONT', 0, 7); p('PLANT', 8, 1); p('CACTUS', 8, 9); p('POT', 0, 9); p('POT', 4, 9);
    area(label, '#7AD1E0', x + 1, y + 1, 7);
    rooms.push({ id, type: 'lounge', label, x, y, w: 9, h: H });
  };
  // jogos: fliperama, pebolim e xadrez
  const salaJogos = (col, row, id, label) => {
    const x = colX(col), y = row;
    const p = (type, dx, dy) => add(type, x + dx, y + dy);
    p('GOLD_FRAME_TEAL', 1, -2); p('GOLD_FRAME_GREEN', 7, -2); p('SMALL_PAINTING', 2, -2); p('SMALL_PAINTING_2', 6, -2);
    for (const [dx, t] of [[0, 'ARCADE_A'], [1, 'ARCADE_B'], [2, 'ARCADE_A'], [6, 'ARCADE_B'], [7, 'ARCADE_A'], [8, 'ARCADE_B']]) {
      p(t, dx, 0); p('WOODEN_BENCH', dx, 2);
    }
    p('FOOSBALL', 1, 4); p('WOODEN_BENCH', 0, 4); p('WOODEN_BENCH', 3, 5);
    p('CHESS_TABLE', 6, 5); p('WOODEN_BENCH', 5, 5); p('WOODEN_BENCH', 7, 5);
    p('CHESS_TABLE', 6, 8); p('WOODEN_BENCH', 5, 8); p('WOODEN_BENCH', 7, 8);
    p('SOFA_FRONT', 0, 8); p('PLANT', 8, 4); p('POT', 3, 9); p('CACTUS', 0, 7);
    area(label, '#7AD1E0', x + 1, y + 3, 7);
    rooms.push({ id, type: 'lounge', label, x, y, w: 9, h: H });
  };
  // sala de reuniao: mesa grande, quadro de status e quadros brancos
  const reuniao = (col, row, id, label) => {
    const x = colX(col), y = row;
    const p = (type, dx, dy) => add(type, x + dx, y + dy);
    p('WHITEBOARD', 0, -2); p('CLOCK', 2, -2); p('STATUS_BOARD', 3, -2); p('CLOCK', 6, -2); p('WHITEBOARD', 7, -2);
    p('MEETING_TABLE', 2, 3);
    for (let dx = 2; dx <= 6; dx++) { p('CUSHIONED_CHAIR_FRONT', dx, 2); p('CUSHIONED_CHAIR_BACK', dx, 6); }
    p('CUSHIONED_CHAIR_SIDE', 1, 4); p('CUSHIONED_CHAIR_SIDE:left', 7, 4);
    p('PLANT', 0, 0); p('PLANT_2', 8, 0); p('COFFEE', 0, 8); p('BIN', 8, 9); p('CACTUS', 0, 5);
    area(label, '#FFC95C', x + 1, y + 1, 7);
    rooms.push({ id, type: 'meeting', label, x, y, w: 9, h: H });
  };
  // cafe e lanche
  const cafe = (col, row, id, label) => {
    const x = colX(col), y = row;
    const p = (type, dx, dy) => add(type, x + dx, y + dy);
    p('GOLD_FRAME_ORANGE', 1, -2); p('CLOCK', 4, -2); p('GOLD_FRAME_TEAL', 7, -2);
    p('SNACK_COUNTER', 0, 1);
    for (const dx of [0, 1, 2]) p('WOODEN_BENCH', dx, 3);
    p('COFFEE_MACHINE', 5, 0); p('VENDING', 6, 0); p('FRIDGE', 7, 0);
    p('SMALL_TABLE_FRONT', 1, 5); p('SMALL_TABLE_FRONT', 5, 5);
    for (const dy of [5, 6]) for (const dx of [0, 3, 4, 7]) p('WOODEN_BENCH', dx, dy);
    p('POT', 0, 9); p('POT', 8, 9); p('CACTUS', 4, 9);
    area(label, '#E6AC3F', x + 1, y + 4, 7);
    rooms.push({ id, type: 'cafe', label, x, y, w: 9, h: H });
  };
  // banheiro: pias na parede de cima, boxes com vaso no fundo
  const banheiro = (col, row, id, label) => {
    const x = colX(col), y = row;
    const p = (type, dx, dy) => add(type, x + dx, y + dy);
    p('SINK', 0, -2); p('SINK', 1, -2); p('MIRROR', 2, -2); p('MIRROR', 6, -2); p('SINK', 7, -2); p('SINK', 8, -2);
    for (const dx of [0, 2, 6, 8]) p('STALL', dx, 0);
    for (const dx of [1, 3, 5, 7]) p('TOILET', dx, 1);
    p('BIN', 0, 8); p('PLANT', 8, 7); p('POT', 4, 9); p('POT', 0, 9);
    area(label, '#7AD1E0', x + 1, y + 4, 7);
    rooms.push({ id, type: 'wc', label, x, y, w: 9, h: H });
  };

  team(0, SQUADS_MAPA[0].slug, SQUADS_MAPA[0].label);
  team(1, SQUADS_MAPA[1].slug, SQUADS_MAPA[1].label);
  team(2, SQUADS_MAPA[2].slug, SQUADS_MAPA[2].label);
  team(3, SQUADS_MAPA[3].slug, SQUADS_MAPA[3].label);
  reuniao(4, TOP, 'reuniao', 'SALA DE REUNIÃO');
  cafe(5, TOP, 'cafe', 'CAFÉ E LANCHE');
  salaTV(0, BOT, 'lazer-tv', 'SALA DE TV');
  salaBar(3, BOT, 'lazer-bar', 'BAR E SINUCA');
  salaJogos(4, BOT, 'lazer-jogos', 'SALA DE JOGOS');
  banheiro(5, BOT, 'banheiro', 'BANHEIRO');

  // area externa: piscina para quem esta de ferias (sem demanda ha mais de 1 semana)
  {
    const p = (type, dx, dy) => add(type, PX + dx, PY + dy);
    for (const [dx, dy] of [[0, 0], [10, 0], [5, 0], [0, 12], [10, 12]]) p('PALM', dx, dy);
    p('POOL_WATER', 2, 5);
    for (const dx of [1, 3, 5, 7, 9]) { p('SUNLOUNGER_FRONT', dx, 3); p('SUNLOUNGER_BACK', dx, 10); p('SUNLOUNGER_BACK', dx, 12); }
    p('PLANT', 0, 2); p('PLANT', 0, 9); p('POT', 10, 6); p('POT', 10, 9);
    area('PISCINA', '#7AD1E0', PX + 2, PY + 1, 7);
    rooms.push({ id: 'piscina', type: 'pool', label: 'PISCINA', x: PX, y: PY, w: 11, h: 14 });
  }
  // recepcao
  {
    const x = colX(1), y = BOT;
    const p = (type, dx, dy) => add(type, x + dx, y + dy);
    p('PLANT_2', 0, -1); p('SMALL_PAINTING', 1, -2); p('CLOCK', 2, -2); p('LARGE_PAINTING', 6, -2); p('PLANT', 8, -1);
    p('DESK_FRONT', 3, 3); p('PC_FRONT_OFF', 4, 3);
    p('SOFA_FRONT', 0, 7); p('SOFA_FRONT', 7, 7); p('COFFEE_TABLE', 0, 5); p('LARGE_PLANT', 7, 4);
    p('POT', 8, 9); p('POT', 0, 9); p('CACTUS', 8, 3); p('CACTUS', 0, 3);
    area('RECEPÇÃO', '#E6AC3F', x + 1, y + 1, 7);
    rooms.push({ id: 'recepcao', type: 'reception', label: 'RECEPÇÃO', x, y, w: 9, h: H, spawn: { col: x + 4, row: y + 9 } });
  }
  // sala do CEO
  {
    const x = colX(2), y = BOT;
    const p = (type, dx, dy) => add(type, x + dx, y + dy);
    p('DOUBLE_BOOKSHELF', 0, -2); p('MIRROR', 2, -2); p('GOLD_FRAME_GREEN', 6, -2); p('GOLD_FRAME_ORANGE', 7, -2); p('PLANT', 8, -1);
    p('DESK_FRONT', 3, 2); p('PC_FRONT_OFF', 4, 2); p('CUSHIONED_CHAIR_BACK', 4, 4);
    p('LARGE_PLANT', 0, 1); p('LARGE_PLANT', 7, 1);
    p('SOFA_BACK', 1, 8); p('SOFA_BACK', 6, 8); p('COFFEE_TABLE', 4, 7); p('COFFEE', 4, 8);
    p('POT', 8, 9); p('GRAND_PIANO', 6, 4); p('CANDELABRA', 2, 4); p('CANDELABRA', 6, 2);
    area('CEO', '#FFC95C', x + 1, y + 6, 7);
    rooms.push({ id: 'ceo', type: 'ceo', label: 'CEO', x, y, w: 9, h: H, seat: { col: x + 4, row: y + 4 } });
  }

  const layout = {
    version: 1,
    cols: COLS,
    rows: ROWS,
    layoutRevision: 2,
    tiles,
    tileColors: colors,
    furniture,
    areas,
    areaTiles,
  };
  return { layout, rooms, hall: { col: 25, row: HALL_Y + 1 } };
}
