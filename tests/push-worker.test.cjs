const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

function preparar(janelas = []) {
  const handlers = new Map();
  const chamadas = [];
  const self = {
    addEventListener: (tipo, handler) => handlers.set(tipo, handler),
    registration: {
      scope: 'https://parkflash.example.test/',
      showNotification: async (titulo, dados) => { chamadas.push(['avisar', titulo, dados]); },
    },
    clients: {
      claim: async () => { chamadas.push(['claim']); },
      matchAll: async () => janelas,
      openWindow: async (url) => { chamadas.push(['abrir', url]); },
    },
  };
  vm.runInNewContext(readFileSync(join(__dirname, '../public/push-worker.js'), 'utf8'), { self, URL });
  return {
    chamadas, handlers, disparar(tipo, dados) {
      let executando;
      handlers.get(tipo)({ ...dados, waitUntil: (p) => { executando = p; } });
      return executando;
    },
  };
}

test('push mostra aviso genérico, ignora payload e não intercepta fetch', async () => {
  const mensagens = [];
  const worker = preparar([{ postMessage: (msg) => mensagens.push(msg) }]);
  assert.equal(worker.handlers.has('fetch'), false);
  await worker.disparar('activate', {});
  await worker.disparar('push', { data: { text: () => 'CPF, chave PIX, valor' } });
  assert.deepEqual(worker.chamadas.slice(0, 1), [['claim']]);
  const [, titulo, dados] = worker.chamadas[1];
  assert.equal(titulo, 'Park Flash');
  assert.equal(dados.body, 'Há uma atualização na sua central de notificações.');
  assert.equal(dados.tag, 'parkflash-central');
  assert.equal(mensagens[0].tipo, 'PARKFLASH_NOTIFICACAO');
});

test('clique abre a central no próprio domínio sem usar dados da notificação', async () => {
  const worker = preparar();
  let fechou = false;
  await worker.disparar('notificationclick', {
    notification: { data: { url: 'https://other.example.test' }, close: () => { fechou = true; } },
  });
  assert.equal(fechou, true);
  assert.deepEqual(worker.chamadas, [['abrir', 'https://parkflash.example.test/app/notificacoes']]);
});

test('clique navega e foca janela existente do Park Flash', async () => {
  let focou = false;
  let destino;
  const worker = preparar([{
    url: 'https://parkflash.example.test/app/dashboard',
    focus: async () => { focou = true; },
    navigate: async (url) => { destino = url; return {}; },
  }]);
  await worker.disparar('notificationclick', { notification: { close() {} } });
  assert.equal(focou, true);
  assert.equal(destino, 'https://parkflash.example.test/app/notificacoes');
  assert.equal(worker.chamadas.length, 0);
});
