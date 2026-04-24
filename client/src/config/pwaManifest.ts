const pwaManifest = {
  name: 'ConvoLab',
  short_name: 'ConvoLab',
  description: 'A creative language learning and dialogue generation tool',
  theme_color: '#5E6AD8',
  background_color: '#ffffff',
  display: 'standalone',
  orientation: 'portrait',
  scope: '/',
  start_url: '/app',
  icons: [
    {
      src: 'pwa-192x192.png',
      sizes: '192x192',
      type: 'image/png',
    },
    {
      src: 'pwa-512x512.png',
      sizes: '512x512',
      type: 'image/png',
    },
    {
      src: 'pwa-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any maskable',
    },
  ],
};

export default pwaManifest;
