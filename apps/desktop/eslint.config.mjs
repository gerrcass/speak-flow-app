// gdp-ts lifecycle lint (ADR-0005): the gdp-ts ESLint preset bans `as`
// proof-forging and minting outside src/proofs/. The empty proof
// interfaces (`interface P<N> extends Proof<...> {}`) are the upstream gdp-ts
// pattern, so @typescript-eslint/no-empty-object-type stays off. Runs in
// `pnpm lint` alongside the hex-gate and typecheck.
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import gdp from "@gdp-ts/core/lint/eslint";

export default [
  ...tseslint.configs.recommended,
  ...gdp({ proofs: ["src/proofs/**"] }),
  {
    name: "speak-flow/proof-pattern",
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
  {
    // Stable hooks rules only: the v6 recommended set adds experimental
    // purity rules that flag pre-existing event-handler code (#4), so pin
    // the two classic rules that CI needs (incl. exhaustive-deps disables).
    name: "speak-flow/react-hooks",
    files: ["src/**/*.tsx"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
