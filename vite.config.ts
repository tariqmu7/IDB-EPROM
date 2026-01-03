import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    // IMPORTANT: Set base to your repository name for GitHub Pages
    base: '/IDB-EPROM/',
    build: {
      outDir: 'dist',
    },
    define: {
      // Polyfill process.env.API_KEY for the browser
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
    },
  };
});