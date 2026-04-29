/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_BUY_NOW_PRICE_MULTIPLIER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
