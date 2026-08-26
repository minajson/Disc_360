import { defineConfig } from "@playwright/test";

/**
 * Smoke suite against a production build and the local Supabase stack.
 * Prerequisites: `npx supabase start` (seeded) and `npm run build`.
 */
/**
 * The port the suite runs on.
 *
 * Overridable because 3100 is not reserved. A different project holding it
 * does not make the suite fail — `reuseExistingServer` connects to whatever
 * is there and every test fails against somebody else's application, which
 * looks exactly like a regression and is not one.
 */
const PORT = process.env.E2E_PORT ?? "3100";

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 90_000,
  retries: 0,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
    // Shared join links/QRs must point at the server under test. SITE_URL is
    // the runtime override — NEXT_PUBLIC_SITE_URL is frozen at build time.
    env: { SITE_URL: `http://localhost:${PORT}`, NEXT_DIST_DIR: ".next-test" },
  },
});
