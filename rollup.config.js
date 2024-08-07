import typescript from "@rollup/plugin-typescript"
import resolve from "@rollup/plugin-node-resolve"
import commonjs from "@rollup/plugin-commonjs"
import filesize from "rollup-plugin-filesize"
import progress from "rollup-plugin-progress"
import terser from "@rollup/plugin-terser"
import babel from "@rollup/plugin-babel"
import json from "@rollup/plugin-json"

import pkg from "./package.json"

const packageName = "ApiSmartDiff"
const inputPath = "./src"

const preamble = `/*!
 * ${pkg.name} v${pkg.version}
 * Copyright (C) 2012-${new Date().getFullYear()} ${pkg.author}
 * Date: ${new Date().toUTCString()}
 */`

const extensions = [".ts", ".js"]

const jsPlugins = [
  resolve(),
  commonjs({
    include: "node_modules/**",
  }),
  json(),
  progress(),
  filesize({
    showGzippedSize: true,
  }),
  typescript(),
  babel({
    babelHelpers: "bundled",
    exclude: "node_modules/**",
    include: [`${inputPath}/**/*`],
    extensions,
  }),
  terser({
    format: {
      preamble,
      comments: false,
    },
  }),
]

function makeConfig(file, format) {
  return {
    input: `${inputPath}/index.ts`,
    output: {
      file,
      format,
      name: packageName,
      sourcemap: true,
    },
    plugins: jsPlugins,
  }
}

export default [makeConfig(pkg.main, "umd"), makeConfig(pkg.module, "esm"), makeConfig(pkg.browser, "iife")]
