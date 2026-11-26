# Contributing

Contributions are welcome — bug reports with a minimal before / after pair, new rules, fixes and documentation. The repository is [udamir/api-smart-diff](https://github.com/udamir/api-smart-diff).

## Reporting a bug

The quickest report is a before / after pair that shows the problem. Paste both documents into the [online demo](/demo) (or edit an [example](/examples/)) and use **Report issue**, or the ⚑ of the diff that is wrong: pick what is wrong (classification, description, a missing or an extra change, a crash), optionally the type you expected and a note, and the portal opens a GitHub issue form prefilled with the version, the detected specification, the `apiCompare(...)` call with its options, the diffs, both documents, your browser and a link that restores the comparison. Nothing is sent until you submit the issue on GitHub; remove anything private from the documents first. Documents too large for a link are left out of the form: **Copy documents** copies them so you can paste or attach them, and **Copy report as Markdown** copies the whole report.

## Policy

It is an objective of api-smart-diff to have no additional runtime dependencies (the current ones are `json-crawl` and `allof-merge`). This may change in the future, but for now, no new dependencies.

## Setup

The project uses pnpm, TypeScript 7 and Vite+ (`vp`) for tests, formatting, linting and builds.

```sh
pnpm install
pnpm test               # all tests (Vitest)
pnpm run check          # format + lint + type-aware checks (vp check); `pnpm exec vp check --fix` to fix
pnpm run typecheck      # tsc --noEmit
pnpm run build          # vp pack -> dist/
```

Run one file or one test:

```sh
pnpm exec vp test run test/openapi/parameters.test.ts
pnpm exec vp test run -t "should reverse simple rules"
```

Please run the checks and the tests before submitting a pull request (`pnpm run check && pnpm test`), and include tests that show your change.

## Where things are

- `src/index.ts` — the public API: the only names the package exports (pinned by `test/core/public-api.test.ts`; a change there is a public API change and needs an update of the API reference).
- `src/api.ts` — `apiCompare`, `detectSpec` and the engine selection.
- `src/core/` — the generic compare engine (`compare.ts`), the session (`$ref` resolution, caches, errors), rule resolution, mapping, rename detection, the usage index and the description engine.
- `src/<spec>/` — one folder per specification (`openapi`, `asyncapi`, `jsonSchema`, `graphapi`), each split into `*.rules.ts` (the rule tree), `*.classify.ts`, `*.mapping.ts`, `*.transform.ts`, `*.annotate.ts` and `*.compare.ts` (the engine wrapper).
- `test/` — tests mirroring the source folders; `test/compat/` is a corpus of change scenarios harvested from other API diff tools, run per variant (placement, direction, encoding); `test/docs/` checks the examples of this site.

## Tests

Typical tests compare two inline documents (the `yaml` and `graphapi` tagged templates of `test/helpers`) and check the `diffs` (count, `type`, `scope`, non-empty `description`) and the merged metadata. A known defect is written as `it.fails(...)`: it passes while the bug exists and fails once it is fixed, so a fix promotes it to `it`. Never weaken a correct expectation to make a test pass.

## Documentation

This site lives in `docs/` (VitePress):

```sh
pnpm docs:dev       # local dev server with hot reload
pnpm docs:build     # static build to docs/.vitepress/dist
pnpm docs:preview   # serve the build
```

The demo and the examples run the library from `src/` in the browser. Examples live in `docs/.vitepress/theme/examples.ts`; each lists the diffs it produces, and `test/docs/examples.test.ts` checks them, so add the expected diffs when you add an example and add its section to `docs/examples/index.md`. The site is deployed to GitHub Pages by `.github/workflows/docs.yml`.
