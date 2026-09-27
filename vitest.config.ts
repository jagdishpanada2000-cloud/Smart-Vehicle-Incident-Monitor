import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: {
    alias: { "npm:@supabase/supabase-js@2": "@supabase/supabase-js" },
  },
  test: { include: ["tests/**/*.test.ts"], testTimeout: 30000 },
});
