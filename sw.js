// Uso sem internet. A página vem da rede quando há conexão boa (e da cópia guardada quando não há);
// as imagens ficam guardadas depois da primeira vez que aparecem. Só guarda o que é mesmo página ou imagem:
// o Wi-Fi com tela de login devolve outra coisa no lugar, e isso não pode entrar no lugar do material.
const PAG = 'rev7-pag-v2', IMG = 'rev7-img-v1';
const tipo = (res, p) => !!res && res.ok && !res.redirected && (res.headers.get('content-type') || '').indexOf(p) === 0;
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(PAG).then(c => Promise.all(['./', 'manifest.webmanifest', 'icon-192.png'].map(u => c.add(u).catch(() => {})))));
});
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== PAG && k !== IMG).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.indexOf('/img/') >= 0) {
    e.respondWith(caches.open(IMG).then(c => c.match(e.request).then(r => r || fetch(e.request).then(res => {
      if (tipo(res, 'image/')) e.waitUntil(c.put(e.request, res.clone()));
      return res;
    }))));
    return;
  }
  const pagina = e.request.mode === 'navigate';
  // a página é guardada sempre com o mesmo endereço, sem "?fbclid=..." nem "index.html", para existir uma cópia só
  const chave = pagina ? new Request(u.origin + u.pathname.replace(/index\.html$/, '')) : e.request;
  const rede = (pagina ? fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(e.request)).then(res => {
    if (pagina ? tipo(res, 'text/html') : res.ok) { const cp = res.clone(); return caches.open(PAG).then(c => c.put(chave, cp)).catch(() => {}).then(() => res); }
    return res;
  });
  e.waitUntil(rede.catch(() => {}));  // mantém o worker vivo até guardar a versão nova, mesmo que a resposta já tenha saído da cópia
  const limite = new Promise((ok, no) => setTimeout(no, 4000));  // internet fraca: depois de 4 s usa a cópia guardada
  e.respondWith(Promise.race([rede, limite]).catch(() => caches.match(chave).then(r => r || (pagina ? caches.match('./', { ignoreSearch: true }) : undefined)).then(r => r || rede)));
});
