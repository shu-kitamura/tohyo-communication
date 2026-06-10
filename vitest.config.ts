import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const migrations = await readD1Migrations("./drizzle");

export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: migrations,
          TEST_BYPASS_TURNSTILE: "true",
          TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
          TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
        },
      },
      wrangler: {
        configPath: "./wrangler.jsonc",
      },
    }),
  ],
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
