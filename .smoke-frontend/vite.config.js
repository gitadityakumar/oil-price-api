import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import { createApiClientPlugin } from './vite-plugin-create-api-client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_TARGET || 'http://localhost:8080';

  return {
    plugins: [
      createApiClientPlugin({
        databaseUrl: env.CREATE_CLIENT_DATABASE_URL || env.DATABASE_URL,
        apiKeyPepper: env.CREATE_CLIENT_API_KEY_PEPPER || env.API_KEY_PEPPER,
      }),
    ],
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          keys: path.resolve(__dirname, 'keys.html'),
        },
      },
    },
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    preview: {
      port: 5173,
      host: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  };
});
