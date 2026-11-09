/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_PRIVY_APP_ID?: string;
  /** Demo mode: swaps in deterministic risk scores so the pitch can show the predictive UI before Phase 4. */
  readonly VITE_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
