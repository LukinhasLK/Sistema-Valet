import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Mesmos arquivos públicos (ícones, logo, push-worker) do front Angular em ../public.
export default defineConfig({
  plugins: [react()],
  publicDir: '../public',
  server: {
    port: 4200,
    proxy: {
      '/api': {
        target: process.env.API_ALVO ?? 'http://127.0.0.1:8080',
        changeOrigin: true,
        // Mesma origem via proxy: sem o cabeçalho Origin o CORS do back end não interfere em portas diferentes.
        configure: (proxy) => proxy.on('proxyReq', (pedido) => pedido.removeHeader('origin')),
      },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/testes/configuracao.ts'],
  },
});
