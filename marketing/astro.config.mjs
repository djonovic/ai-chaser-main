import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://chaseai.app',
  output: 'static',
  server: {
    port: 4321,
    host: true,
  },
  adapter: vercel({
    webAnalytics: { enabled: false },
  }),
  integrations: [
    sitemap(),
    react(),
    mdx(),
  ],
  vite: {
    build: {
      target: 'es2020',
    },
    ssr: {
      noExternal: ['lucide-react'],
    },
  },
});
