import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// O proxy encaminha /api -> backend, mantendo o cookie de sessão "same-origin"
// durante o desenvolvimento (evita complicações de CORS/cookies cross-site).
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // React/router/axios mudam raramente: em arquivo separado, quem já tem o
        // site no celular não rebaixa tudo a cada atualização do nosso código.
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'axios'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3333',
    },
  },
});
