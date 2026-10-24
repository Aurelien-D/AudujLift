import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// BASE_PATH permet de publier sous un sous-dossier (ex. GitHub Pages : /audujlift/)
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'AudujLift',
        short_name: 'AudujLift',
        description: 'Suivi musculation & nutrition',
        lang: 'fr',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Gros jeux de données : téléchargés au premier usage puis mis en cache (pas à l'installation)
        globIgnores: ['**/off-fr-*.js', '**/exercise-guides-*.js'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /\/assets\/(off-fr|exercise-guides)-.*\.js$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'datasets', expiration: { maxEntries: 6 } },
          },
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/gh\/yuhonas\/free-exercise-db.*/,
            handler: 'CacheFirst',
            options: { cacheName: 'exercise-images', expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 180 } },
          },
          {
            urlPattern: /^https:\/\/images\.openfoodfacts\.org\/.*/,
            handler: 'CacheFirst',
            options: { cacheName: 'off-images', expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 60 } },
          },
        ],
      },
    }),
  ],
})
