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
    ".pnpm-store/**",
    ".understand-anything/**",
    "learn-claude-code/**",
    "release/**",
    "apps/mobile/android/**/build/**",
    "apps/mobile/android/app/src/main/assets/**",
    "apps/mobile/dist/**",
    "apps/mobile/ios/App/App/public/**",
    "next-env.d.ts",
    // 评测题目是给 agent 改的样本项目（含故意留空的 stub），不按本项目规范检查
    "eval/tasks/**",
  ]),
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
