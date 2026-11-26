"use strict"
// Fetches everything the benchmark needs that is not committed, pinned in fixtures/vendor/sources.json:
//   bin       release binaries of the Go CLIs (oasdiff, openapi-changes, buf) into bin/, sha256-checked
//   docs      third-party documents into fixtures/vendor/ (GitHub REST description, GitHub GraphQL schema), sha256-checked
//   sources   git clones of the Netcracker fork and the three fork packages it needs into sources/, at pinned commits
// Already present files are kept (delete them to re-fetch). Nothing is installed globally.
//   node scripts/fetch.js [--only bin,docs,sources]
const fs = require("node:fs")
const path = require("node:path")
const crypto = require("node:crypto")
const { execFileSync } = require("node:child_process")
const P = require("./paths")

const S = JSON.parse(fs.readFileSync(path.join(P.VENDOR, "sources.json"), "utf8"))
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1].split(",") : ["bin", "docs", "sources"]
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: "inherit", ...opts })
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const download = (url, file) => sh("curl", ["-fsSL", "--retry", "3", "-m", "600", "-o", file, url])
const verify = (file, expected) => {
  const got = sha256(file)
  if (got !== expected) {
    fs.rmSync(file, { force: true })
    throw new Error(`${path.basename(file)}: sha256 ${got}, expected ${expected}`)
  }
}

if (only.includes("bin")) {
  const platform = `${process.platform}-${process.arch}`
  fs.mkdirSync(P.BIN, { recursive: true })
  for (const b of S.binaries) {
    const target = path.join(P.BIN, b.name)
    if (fs.existsSync(target)) {
      console.log(`bin/${b.name}: present`)
      continue
    }
    const asset = b.assets[platform]
    if (!asset) {
      console.error(`bin/${b.name}: no pinned release asset for ${platform} (see fixtures/vendor/sources.json); the ${b.name} rows will be skipped`)
      continue
    }
    const tmp = path.join(P.BIN, `${b.name}.tar.gz`)
    download(asset.url, tmp)
    verify(tmp, asset.sha256)
    const dir = path.join(P.BIN, `${b.name}-x`)
    fs.mkdirSync(dir, { recursive: true })
    sh("tar", ["-xzf", tmp, "-C", dir])
    fs.renameSync(path.join(dir, b.inner), target)
    fs.rmSync(dir, { recursive: true, force: true })
    fs.rmSync(tmp)
    fs.chmodSync(target, 0o755)
    console.log(`bin/${b.name}: ${b.version} (${platform})`)
  }
}

if (only.includes("docs")) {
  for (const d of S.documents) {
    const target = path.join(P.VENDOR, d.file)
    if (fs.existsSync(target)) {
      console.log(`fixtures/vendor/${d.file}: present`)
      continue
    }
    const tmp = `${target}.download`
    download(d.url, tmp)
    verify(tmp, d.sha256)
    if (d.normalize === "printSchema") {
      // the published SDL has duplicate field definitions that graphql's SDL validation rejects; printSchema of the
      // schema built without that validation keeps one definition per field, print(parse()) gives the compact layout
      const g = require("graphql")
      fs.writeFileSync(target, g.print(g.parse(g.printSchema(g.buildSchema(fs.readFileSync(tmp, "utf8"), { assumeValidSDL: true })))))
      fs.rmSync(tmp)
      if (d.normalizedSha256 && sha256(target) !== d.normalizedSha256) console.warn(`fixtures/vendor/${d.file}: normalized sha256 ${sha256(target)}, expected ${d.normalizedSha256} (another graphql version?)`)
    } else fs.renameSync(tmp, target)
    console.log(`fixtures/vendor/${d.file}: ${fs.statSync(target).size} bytes`)
  }
}

if (only.includes("sources")) {
  fs.mkdirSync(P.SOURCES, { recursive: true })
  for (const r of S.repositories) {
    const dir = path.join(P.SOURCES, r.dir)
    if (fs.existsSync(path.join(dir, ".git"))) {
      const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" }).trim()
      console.log(`sources/${r.dir}: present at ${head.slice(0, 7)}${head === r.commit ? "" : ` (pinned ${r.commit.slice(0, 7)})`}`)
      continue
    }
    fs.mkdirSync(dir, { recursive: true })
    sh("git", ["init", "-q"], { cwd: dir })
    sh("git", ["fetch", "-q", "--depth", "1", r.url, r.commit], { cwd: dir })
    sh("git", ["-c", "advice.detachedHead=false", "checkout", "-q", "FETCH_HEAD"], { cwd: dir })
    console.log(`sources/${r.dir}: ${r.commit.slice(0, 7)}`)
  }
}
