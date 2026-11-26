import { createRequire } from "node:module"

import { defineConfig } from "vite-plus"

// ES2020 output (POLICY-110): optional chaining and `??` stay native; requires Node >= 18 and Chrome 80 / Firefox 74 /
// Safari 13.1
const target = "es2020"

// test files that assert wall-clock limits
const timedTests = ["test/performance.test.ts", "test/compat/core/performance-targets.test.ts"]

export default defineConfig({
  pack: [
    {
      // library: ESM + CJS with declarations; json-crawl and allof-merge stay runtime dependencies
      entry: ["src/index.ts"],
      format: ["esm", "cjs"],
      platform: "neutral",
      target,
      dts: true,
      sourcemap: true,
    },
    {
      // self-contained browser build for <script> tags and CDNs, exposes the `ApiSmartDiff` global
      entry: { "api-smart-diff": "src/index.ts" },
      format: "iife",
      globalName: "ApiSmartDiff",
      platform: "browser",
      target,
      minify: true,
      sourcemap: true,
      deps: { alwaysBundle: ["json-crawl", "allof-merge"], onlyBundle: ["json-crawl", "allof-merge"] },
      // the 1.x file name, kept for the CDN links (`unpkg` / `jsdelivr`) and the demo page
      outputOptions: { entryFileNames: "[name].min.js" },
      clean: false,
    },
  ],
  test: {
    globals: true,
    // the CommonJS gqlapi build loads graphql's CommonJS entry; the tests must use that same module, or GraphQL's realm
    // check rejects the schemas they build (Vite would pick graphql's ESM `module` entry for the test files)
    alias: { graphql: createRequire(import.meta.url).resolve("graphql") },
    // the tests with time limits run after the others, one file at a time, so that parallel test files do not slow
    // them down (inline projects inherit everything else above)
    projects: [
      {
        test: { name: "unit", include: ["test/**/*.test.ts"], exclude: timedTests, sequence: { groupOrder: 0 } },
      },
      {
        test: { name: "timed", include: timedTests, fileParallelism: false, sequence: { groupOrder: 1 } },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      reporter: ["text", "lcov"],
    },
  },
  lint: {
    // benchmark/ is an independent project with its own package.json, dependencies and tooling
    ignorePatterns: [
      "dist/**",
      "coverage/**",
      "temp/**",
      "benchmark/**",
      "docs/.vitepress/cache/**",
      "docs/.vitepress/dist/**",
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {
    ignorePatterns: [
      "dist/**",
      "coverage/**",
      "temp/**",
      "benchmark/**",
      "pnpm-lock.yaml",
      "docs/.vitepress/cache/**",
      "docs/.vitepress/dist/**",
      "*.md",
      "test/compat/coverage/**",
      // fixtures are test data: their exact text is part of what the tests read
      "test/resources/**",
    ],
    semi: false,
    printWidth: 120,
  },
})
