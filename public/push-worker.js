/* Worker exclusivo de notificações. As requisições e atualizações permanecem no navegador. */
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  event.waitUntil(Promise.all([
    self.registration.showNotification('Park Flash', {
      body: 'Há uma atualização na sua central de notificações.',
      icon: '/pwa/icon-192.png',
      tag: 'parkflash-central',
    }),
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) janela.postMessage({ tipo: 'PARKFLASH_NOTIFICACAO' });
    }),
  ]));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const destino = new URL('app/notificacoes', self.registration.scope).href;
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existente = janelas.find((janela) => janela.url === destino);
    if (existente) {
      await existente.focus();
      return;
    }
    const app = janelas.find((janela) => janela.url.startsWith(self.registration.scope + 'app/'));
    if (app) {
      try {
        // Navegação e foco são iniciados no mesmo evento de clique.
        const resultados = await Promise.allSettled([app.navigate(destino), app.focus()]);
        if (resultados[0].status === 'fulfilled' && resultados[0].value) return;
      } catch {
        // Abrir uma janela continua disponível quando a existente foi fechada.
      }
    }
    await self.clients.openWindow(destino);
  })());
});
