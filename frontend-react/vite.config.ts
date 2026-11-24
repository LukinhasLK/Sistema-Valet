import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Arquivos públicos próprios (ícones, logo, push-worker); copiados de ../public do Angular.
export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
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
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Bibliotecas em pacotes próprios: mudam pouco e ficam no cache entre versões do sistema.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom', 'zustand'],
          movimento: ['motion', 'motion/react'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/testes/configuracao.ts'],
  },
});
