"use strict"
// Minimal jest transformer: TypeScript -> CommonJS with esbuild (no type-checking).
const crypto = require("node:crypto")
const esbuild = require("esbuild")

module.exports = {
  process(src, filename) {
    const r = esbuild.transformSync(src, {
      loader: filename.endsWith(".tsx") ? "tsx" : "ts",
      format: "cjs",
      target: "node20",
      sourcemap: "inline",
      sourcefile: filename,
    })
    return { code: r.code }
  },
  getCacheKey(src, filename) {
    return crypto.createHash("md5").update(src).update(filename).update("v1").digest("hex")
  },
}
