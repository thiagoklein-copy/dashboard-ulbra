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
    // Google Ads Scripts, não Node: rodam dentro da conta do anunciante, e
    // `main()` é o ponto de entrada que a plataforma chama — o arquivo não
    // exporta nem invoca nada, então a regra de "definido e nunca usado"
    // dispara em todos eles sem ter o que apontar.
    "scripts/google-ads/**",
  ]),
]);

export default eslintConfig;
