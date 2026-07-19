import { defineConfig } from "@playwright/test";

/**
 * Smoke suite against a production build and the local Supabase stack.
 * Prerequisites: `npx supabase start` (seeded) and `npm run build`.
 */
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 90_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run start -- -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 60_000,
    // Shared join links/QRs must point at the server under test. SITE_URL is
    // the runtime override — NEXT_PUBLIC_SITE_URL is frozen at build time.
    env: { SITE_URL: "http://localhost:3100", NEXT_DIST_DIR: ".next-test" },
  },
});
