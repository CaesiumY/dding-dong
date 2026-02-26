import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';

export default defineConfig({
  site: 'https://caesiumy.github.io',
  base: '/dding-dong/',
  i18n: {
    locales: ['en', 'ko'],
    defaultLocale: 'en',
  },
  integrations: [sitemap(), icon()],
  vite: {
    plugins: [tailwindcss()],
  },
});
