import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Use '.' instead of process.cwd() to avoid issues in some environments
  const env = loadEnv(mode, '.', '');
  
  return {
    plugins: [react()],
    define: {
      // Polyfill process.env to prevent crashes in older code/libraries
      'process.env': JSON.stringify(env),
      // Explicitly define API keys if needed
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.VITE_API_KEY)
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    server: {
      host: true
    }
  };
});