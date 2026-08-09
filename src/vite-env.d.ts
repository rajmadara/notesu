/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Base URL of the Express API. Unset in local dev (falls back to
  // localhost:3001); set to the deployed backend's URL in production.
  readonly VITE_API_URL?: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Fontsource packages are CSS-only and ship no type declarations.
declare module '@fontsource-variable/manrope'
declare module '@fontsource-variable/bricolage-grotesque'
