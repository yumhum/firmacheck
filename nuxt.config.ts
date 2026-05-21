// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    mapyApiKey: '', // set via NUXT_MAPY_API_KEY
    dbPath: './data/firmacheck.db', // set via NUXT_DB_PATH
    public: {
      mapyApiKey: '', // set via NUXT_PUBLIC_MAPY_API_KEY (used for client-side map tiles)
    },
  },
  nitro: {
    // better-sqlite3 is a native module — keep it external, never bundle it
    externals: { external: ['better-sqlite3'] },
  },
})
