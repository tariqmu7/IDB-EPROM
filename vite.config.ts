import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    // Base URL is critical for GitHub Pages deployment
    base: '/IDB-EPROM/',
    define: {
      // Polyfill process.env for the app to access the API Key during build
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    },
    build: {
      outDir: 'dist',
    }
  };
});