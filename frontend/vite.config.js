import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/recharts')) return 'charts';
          if (id.includes('node_modules/react-hook-form') || id.includes('node_modules/zod') || id.includes('node_modules/@hookform')) return 'forms';
          if (id.includes('node_modules/react') || id.includes('node_modules/react-router')) return 'react';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5174,
  },
});
