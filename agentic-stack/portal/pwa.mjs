// Pos-build do PWA sobre a pasta de saida: ajusta o index.html (nome, tema, icone do iOS) e grava o service worker com a versao do build.
// Uso: node pwa.mjs <pasta-de-saida>. Cada troca tem de casar exatamente uma vez, senao o build falha.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const out = process.argv[2];
const here = path.dirname(fileURLToPath(import.meta.url));
const idx = path.join(out, "index.html");
let h = fs.readFileSync(idx, "utf8");
for (const [de, para] of [
  ['<html lang="en">', '<html lang="pt-BR">'],
  ["<title>Pixel Agents</title>", "<title>AI Games Factory</title>"],
  ['<meta name="theme-color" content="#1e1e2e" />', '<meta name="theme-color" content="#08090C" />\n    <meta name="description" content="Escritório pixel art da fábrica de jogos (somente leitura)." />'],
  ['<meta name="apple-mobile-web-app-title" content="Pixel Agents" />', '<meta name="apple-mobile-web-app-title" content="AI Games" />'],
  ['<link rel="apple-touch-icon" href="./icons/icon-256.png?v=2" />', '<link rel="apple-touch-icon" href="./icons/factory-180.png" />'],
]) {
  const n = h.split(de).length - 1;
  if (n !== 1) throw new Error(`index.html: trecho casou ${n}x (esperado 1): ${de}`);
  h = h.replace(de, () => para);
}
fs.writeFileSync(idx, h);

// versao do service worker: carimbo do build + nome do bundle principal (muda a cada release)
const bundle = /assets\/(index-[A-Za-z0-9_-]+)\.js/.exec(h)?.[1] ?? "sem-bundle";
const versao = `${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${bundle}`;
const sw = fs.readFileSync(path.join(here, "sw.template.js"), "utf8");
if (!sw.includes("__VERSAO__")) throw new Error("sw.template.js sem __VERSAO__");
const assets = fs.readdirSync(path.join(out, "assets")).filter((f) => /\.(js|css)$/.test(f)).map((f) => "./assets/" + f);
if (!assets.length) throw new Error("sem js/css em assets/");
fs.writeFileSync(path.join(out, "sw.js"), sw.replace("__VERSAO__", versao).replace("__ASSETS__", JSON.stringify(assets)));
for (const f of ["manifest.webmanifest", "icons/factory-192.png", "icons/factory-512.png", "icons/factory-512-maskable.png", "icons/factory-180.png"])
  if (!fs.existsSync(path.join(out, f))) throw new Error("falta " + f);
console.log("pwa ok: sw " + versao);
