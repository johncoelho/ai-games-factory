// Confere o mapa: todo piso livre e todo assento tem de estar ligado ao corredor por tiles livres (senao agentes ficam presos).
// Uso: node portal/tools/check-mapa.mjs <furniture-catalog.json do build>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLayout } from '../layout.mjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const catalogo = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const porId = new Map(catalogo.map((e) => [e.id, e]));
const { layout, hall } = buildLayout();
const { cols, rows, tiles, furniture } = layout;
const blocked = new Set();
const seats = [];
for (const f of furniture) {
  const base = f.type.split(':')[0];
  const e = porId.get(base);
  if (!e) throw new Error('movel sem catalogo: ' + f.type);
  for (let dr = 0; dr < e.footprintH; dr++) for (let dc = 0; dc < e.footprintW; dc++) {
    if (dr < (e.backgroundTiles || 0)) continue;
    blocked.add(f.col + dc + ',' + (f.row + dr));
  }
  if (e.category === 'chairs') seats.push({ type: f.type, col: f.col, row: f.row });
}
const livre = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows && tiles[r * cols + c] !== 255 && tiles[r * cols + c] !== 0 && !blocked.has(c + ',' + r);
const visto = new Set();
const fila = [hall.col + ',' + hall.row];
while (fila.length) {
  const k = fila.pop();
  if (visto.has(k)) continue;
  const [c, r] = k.split(',').map(Number);
  if (!livre(c, r)) continue;
  visto.add(k);
  fila.push(c + 1 + ',' + r, c - 1 + ',' + r, c + ',' + (r + 1), c + ',' + (r - 1));
}
let erros = 0;
for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
  if (livre(c, r) && !visto.has(c + ',' + r)) { console.log('piso livre desligado do corredor:', c, r); erros++; }
}
for (const s of seats) {
  const viz = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => visto.has(s.col + a + ',' + (s.row + b)));
  if (!viz) { console.log('assento sem acesso:', s.type, s.col, s.row); erros++; }
}
console.log(erros ? erros + ' problema(s)' : 'mapa ok: ' + seats.length + ' assentos, todos acessiveis');
process.exit(erros ? 1 : 0);
void aqui;
