import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // GOVERNING SECURITY RULE (Phase D): customer-portal code must NEVER use the
  // service-role admin client. All portal reads go through the session-bound
  // anon client so Postgres RLS enforces tenant isolation. This zone fails the
  // build if any portal file imports the admin client (or constructs its own
  // service-role client). A CI grep (npm run guard:portal) backs this up.
  {
    files: ["src/app/portal/**/*.{ts,tsx}", "src/lib/portal/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/supabase/admin",
              message:
                "Portal code must not use the service-role admin client. Use the session client (@/lib/supabase/server).",
            },
            {
              name: "@supabase/supabase-js",
              importNames: ["createClient"],
              message:
                "Portal code must not construct a Supabase client directly. Use @/lib/supabase/server (session-bound, RLS-enforced).",
            },
          ],
          patterns: [
            {
              group: ["**/lib/supabase/admin", "**/supabase/admin"],
              message:
                "Portal code must not import the service-role admin client. Use @/lib/supabase/server.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
