import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // API_TARGET (optional, e.g. in .env.local) points the dev proxy at a backend on another port.
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: { '/api': env.API_TARGET || 'http://localhost:4000' },
    },
  };
});
