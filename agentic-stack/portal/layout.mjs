// Gera o mapa do escritorio da fabrica: 10 salas em 2 fileiras, ligadas por um corredor.
// Fileira de cima: 5 salas de time (Naval Battle, Agentic Stack, Monopoly, Marketing, Domínio). O antigo lazer 3 virou a sala do Domínio.
// Fileira de baixo: lazer 1, recepcao, sala do CEO, lazer 2, lazer 4.
// Devolve o layout do Pixel Agents e a lista de salas (usada para escolher mesa e sofa de cada agente).

const VOID = 255;
const WALL = 0;

const WOOD = { tile: 7, color: { h: 25, s: 48, b: -43, c: -88 } };
const BLUE = { tile: 1, color: { h: 209, s: 39, b: -25, c: -80 } };
const HALL = { tile: 3, color: { h: 215, s: 18, b: -38, c: -55 } };
const MARBLE = { tile: 2, color: { h: 35, s: 18, b: -22, c: -45 } };
const CEO_FLOOR = { tile: 6, color: { h: 18, s: 55, b: -62, c: -75 } };

export const SQUADS_MAPA = [
  { slug: 'naval-battle', label: 'SQUAD BATALHA NAVAL' },
  { slug: 'agentic-stack', label: 'AGENTIC STACK TEAM' },
  { slug: 'dominiogame', label: 'SQUAD DOMÍNIO' },
  { slug: 'marketing-squad', label: 'SQUAD MARKETING' },
  { slug: 'dominiogame', label: 'SQUAD DOMÍNIO' },
];

export function buildLayout() {
  const COLS = 51; // 5 salas de 9 + 6 paredes
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
  for (let i = 0; i < 5; i++) {
    floor(colX(i), TOP, 9, H, WOOD); // fileira de cima: 5 salas de time
  }
  floor(colX(0), BOT, 9, H, BLUE); // lazer 1
  floor(colX(1), BOT, 9, H, MARBLE); // recepcao
  floor(colX(2), BOT, 9, H, CEO_FLOOR); // CEO
  floor(colX(3), BOT, 9, H, BLUE); // lazer 2
  floor(colX(4), BOT, 9, H, BLUE); // lazer 4
  floor(1, HALL_Y, 49, 3, HALL); // corredor

  // portas da fileira de baixo: 3 tiles de largura atravessando o vazio (linha 16) e a parede (linha 17)
  for (let i = 0; i < 5; i++) {
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
    p('CACTUS', 8, 3); p('PLANT', 8, 8); p('CACTUS', 4, 9);
    p('DESK_FRONT', 1, 1); p('DESK_FRONT', 5, 1); p('PC_FRONT_OFF', 2, 1); p('PC_FRONT_OFF', 6, 1);
    p('CUSHIONED_BENCH', 2, 3); p('CUSHIONED_BENCH', 6, 3);
    p('TABLE_FRONT', 3, 5);
    p('WOODEN_CHAIR_SIDE', 2, 5); p('WOODEN_CHAIR_SIDE', 2, 7); p('WOODEN_CHAIR_SIDE:left', 6, 5); p('WOODEN_CHAIR_SIDE:left', 6, 7);
    p('PC_SIDE', 3, 5); p('PC_SIDE', 3, 7); p('PC_SIDE:left', 5, 5); p('PC_SIDE:left', 5, 7);
    p('SMALL_TABLE_SIDE', 0, 7); p('COFFEE', 0, 8); p('PLANT_2', 0, 6); p('BIN', 1, 9);
    area(label, '#FFC95C', x + 1, y + 4, 7);
    rooms.push({ id: slug, type: 'team', label, x, y, w: 9, h: H });
  };
  const lounge = (col, row, id, label) => {
    const x = colX(col), y = row;
    const p = (type, dx, dy) => add(type, x + dx, y + dy);
    p('PLANT_2', 0, -1);
    // fileira de baixo: o meio (dx 3 a 5) e a porta, entao os quadros ficam dos lados
    if (row === BOT) { p('SMALL_PAINTING', 1, -2); p('SMALL_PAINTING_2', 2, -2); p('LARGE_PAINTING', 6, -2); }
    else { p('SMALL_PAINTING', 1, -2); p('LARGE_PAINTING', 3, -2); p('SMALL_PAINTING_2', 6, -2); }
    p('PLANT', 8, -1);
    p('COFFEE_TABLE', 4, 3); p('SOFA_SIDE', 3, 3); p('SOFA_FRONT', 4, 2); p('SOFA_BACK', 4, 5); p('SOFA_SIDE:left', 6, 3); p('COFFEE', 4, 4);
    p('WOODEN_BENCH', 1, 1); p('WOODEN_BENCH', 7, 1); p('WOODEN_BENCH', 1, 8); p('WOODEN_BENCH', 7, 8);
    p('POT', 0, 9); p('POT', 8, 9);
    p('CACTUS', 0, 5); p('CACTUS', 8, 5);
    if (row !== BOT) p('GOLD_FRAME_TEAL', 5, -2);
    area(label, '#7AD1E0', x + 1, y, 7);
    rooms.push({ id, type: 'lounge', label, x, y, w: 9, h: H });
  };

  team(0, SQUADS_MAPA[0].slug, SQUADS_MAPA[0].label);
  team(1, SQUADS_MAPA[1].slug, SQUADS_MAPA[1].label);
  team(2, SQUADS_MAPA[2].slug, SQUADS_MAPA[2].label);
  team(3, SQUADS_MAPA[3].slug, SQUADS_MAPA[3].label);
  team(4, SQUADS_MAPA[4].slug, SQUADS_MAPA[4].label);
  lounge(0, BOT, 'lazer-1', 'LAZER 1');
  lounge(3, BOT, 'lazer-2', 'LAZER 2');
  lounge(4, BOT, 'lazer-4', 'LAZER 4');

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
    p('POT', 8, 6); p('GRAND_PIANO', 6, 4); p('CANDELABRA', 2, 3); p('CANDELABRA', 6, 2);
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
