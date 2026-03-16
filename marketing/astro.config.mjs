import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://chaseai.app',
  output: 'static',
  adapter: vercel({
    webAnalytics: { enabled: true },
  }),
  integrations: [
    sitemap(),
    react(),
  ],
  vite: {
    ssr: {
      noExternal: ['lucide-react'],
    },
  },
});
