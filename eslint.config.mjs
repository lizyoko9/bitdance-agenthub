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
    "dist-electron/**",
    ".tmp/**",
    ".codex-runlogs/**",
    ".external/**",
    "tmp/**",
    "output/**",
    ".agenthub-data/**",
    ".agenthub-data-e2e/**",
    ".pnpm-store/**",
    ".understand-anything/**",
    "learn-claude-code/**",
    "release/**",
    "release-latest/**",
    "release-*/**",
    ".electron-package/**",
    "apps/mobile/android/**/build/**",
    "apps/mobile/android/app/src/main/assets/**",
    "apps/mobile/dist/**",
    "apps/mobile/ios/App/App/public/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
