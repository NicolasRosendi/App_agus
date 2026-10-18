import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: { '/api': 'http://localhost:4000', '/uploads': 'http://localhost:4000' },
  },
  // Leaflet y three.js quedan en chunks propios vía lazy() de las pantallas.
  build: { chunkSizeWarningLimit: 900 },
});
