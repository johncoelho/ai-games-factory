/* Service worker do portal (PWA). Simples e conservador, de proposito:
 * - so cuida do shell estatico do proprio site; qualquer outra origem (Supabase, GitHub) passa direto, sem cache;
 * - paginas (navegacao): rede primeiro, para nunca prender um index.html velho; o cache so entra se estiver sem rede;
 * - js/css com hash no nome (assets/index-AbC123.js): cache primeiro, seguro porque o nome muda a cada release;
 * - todo o resto (JSON de layout, imagens, dados) vai direto para a rede, sem cache;
 * - a versao abaixo e gravada no build; ao mudar, os caches antigos sao apagados na ativacao e o SW novo assume na hora.
 */
const VERSAO = '20261124002634-index-DksivAb9';
const CACHE = 'factory-shell-' + VERSAO;
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/factory-192.png', './icons/factory-512.png'].concat(["./assets/browser-CN3qBirH.js","./assets/browserMock-BV8i3-iW.js","./assets/index-DksivAb9.js","./assets/index-LahxKHqq.css","./assets/rolldown-runtime-CNC7AqOf.js"]); // __ASSETS__: js/css com hash, gravados no build (abre offline na primeira visita)
const COM_HASH = /\/assets\/[^/]+-[A-Za-z0-9_-]{8}\.(?:js|css)$/;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('factory-shell-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase e qualquer dado ao vivo: nunca passa pelo cache

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(
        (res) => {
          if (res.ok && !url.search) {
            const copia = res.clone(); // clonar antes de devolver, senao o corpo ja foi consumido
            e.waitUntil(caches.open(CACHE).then((c) => c.put('./index.html', copia)));
          }
          return res;
        },
        () => caches.match('./index.html').then((r) => r ?? Response.error()),
      ),
    );
    return;
  }

  if (COM_HASH.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            if (res.ok) {
              const copia = res.clone();
              e.waitUntil(caches.open(CACHE).then((c) => c.put(req, copia)));
            }
            return res;
          }),
      ),
    );
  }
  // qualquer outro pedido: sem respondWith, o navegador vai direto para a rede
});
