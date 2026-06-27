import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const base = env.VITE_BASE_PATH || '/Destination-Trip-Guide/';

  return {
    base,
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [tailwindcss(), ...react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: (moduleId) => {
            const id = moduleId.replace(/\\/g, '/');
            if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react';
            if (id.includes('/node_modules/leaflet/')) return 'vendor-leaflet';
            if (id.includes('/node_modules/lucide-react/')) return 'vendor-icons';
            return undefined;
          },
        },
      },
    },
  };
});
