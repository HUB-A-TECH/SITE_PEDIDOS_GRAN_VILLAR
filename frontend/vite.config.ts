import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// O proxy encaminha /api -> backend, mantendo o cookie de sessão "same-origin"
// durante o desenvolvimento (evita complicações de CORS/cookies cross-site).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3333',
    },
  },
});
