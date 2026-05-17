// sw.js
// Um Service Worker básico é obrigatório para que os navegadores mobile 
// identifiquem a aplicação como instalável (PWA).

self.addEventListener("install", (event) => {
  console.log("Service Worker: Instalado");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker: Ativado");
  return self.clients.claim();
});

// Intercepta requisições de rede. No momento, apenas deixa passar, 
// mas é obrigatório existir para o PWA passar nas validações do Lighthouse.
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request).catch(() => {
    // Aqui você poderia retornar uma página "Você está offline" no futuro.
    return new Response('Offline');
  }));
});
