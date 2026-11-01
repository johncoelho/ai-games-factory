#!/usr/bin/env bash
# Monta o portal visual: Pixel Agents (MIT) na versao fixada + a camada da fabrica (overlay/).
# Uso: bash portal/build.sh <pasta-de-saida>   (ex.: o repo ai-games-factory/portal)
set -euo pipefail

PIXEL_REPO="https://github.com/pablodelucca/pixel-agents"
PIXEL_COMMIT="b1bafd0"   # v1.5.0
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${1:?informe a pasta de saida}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

git clone -q "$PIXEL_REPO" "$WORK/pa"
git -C "$WORK/pa" checkout -q "$PIXEL_COMMIT"
cd "$WORK/pa"
npm ci --ignore-scripts --no-audit --no-fund >/dev/null
(cd webview-ui && npm ci --ignore-scripts --no-audit --no-fund >/dev/null \
  && npm i @supabase/supabase-js@2.45.4 --save-exact --ignore-scripts --no-audit --no-fund >/dev/null)

# camada da fabrica por cima dos arquivos originais
cp -r "$HERE/overlay/." .
# o mock de assets deixa de ser so de desenvolvimento
sed -i 's/if (isBrowserRuntime && import.meta.env.DEV) {/if (isBrowserRuntime) {/' webview-ui/src/App.tsx
node "$HERE/patches.mjs" "$PWD"   # comportamento do escritorio da fabrica
sed -i "s/lastSeenVersion: '1.2'/lastSeenVersion: '1.3'/" webview-ui/src/browserMock.ts   # sem aviso de "atualizado"
grep -q 'if (isBrowserRuntime) {' webview-ui/src/App.tsx || { echo "patch do App.tsx nao aplicou"; exit 1; }

(cd webview-ui && npm run build 2>&1 | grep -E "error|built" | head -30)

rm -rf "$OUT"
mkdir -p "$OUT"
cp -r dist/webview/. "$OUT/"
rm -f "$OUT/Screenshot.jpg" "$OUT/banner.png"
cp LICENSE "$OUT/LICENSE-pixel-agents.txt"
cat > "$OUT/CREDITS.txt" <<'EOF'
Escritorio visual: Pixel Agents (https://github.com/pablodelucca/pixel-agents), licenca MIT (LICENSE-pixel-agents.txt).
Moveis do CEO (piano, candelabro, molduras, espelho): Roguelike Indoors, de Kenney (https://kenney.nl), CC0.
Personagens baseados em Metro City, de JIK-A-4 (https://jik-a-4.itch.io/metrocity-free-topdown-character-pack).
EOF
echo "pronto: $OUT"
