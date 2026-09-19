import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
  base: env.VITE_BASE || '/',
  plugins: [react(), VitePWA({ registerType: 'autoUpdate', includeAssets: ['favicon.ico'], workbox: { maximumFileSizeToCacheInBytes: 5 * 1024 * 1024 }, manifest: { name: 'Pabandi CRM', short_name: 'Pabandi', description: 'Property Management & Sales CRM', theme_color: '#6366f1', background_color: '#0f172a', display: 'standalone' } })],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/external': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
};
});
