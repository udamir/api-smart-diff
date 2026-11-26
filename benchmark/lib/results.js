"use strict"
// Result-file helpers shared by the runners (bench / heap / quality / cli).
// - update(file, init, fn): re-reads the result file right before every write, applies fn to the current content and
//   writes it atomically (temp file + rename), so a run never drops cells that another run (an earlier chunk, or one
//   started in parallel on other fixtures) wrote after it started.
// - runEnv(partial): the environment record of a run. A full run (no --fixtures / --adapters / --tools selection) sets
//   env.date; a partial run keeps env.date of the last full run and appends itself to env.partialRuns. BENCH_RUN_DATE
//   (ISO date) names the start of a run executed in chunks: every chunk with the same BENCH_RUN_DATE counts as part of
//   that full run and sets env.date to it. Every cell carries measuredAt, so stale cells can be told apart.
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

const read = (file, init) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : init())

const update = (file, init, fn) => {
  const cur = read(file, init)
  fn(cur)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(cur, null, 1))
  fs.renameSync(tmp, file)
  return cur
}

const machine = () => ({ node: process.version, platform: `${os.type()} ${os.release()} ${os.arch()}`, cpu: os.cpus()[0].model, cores: os.cpus().length, memGB: Math.round(os.totalmem() / 2 ** 30) })

// applies the run's environment to data.env (see the header)
const applyEnv = (data, { partial, selection }) => {
  const now = new Date().toISOString()
  const runDate = process.env.BENCH_RUN_DATE
  if (runDate) {
    const prev = data.env?.date === runDate ? data.env.chunks || [] : []
    data.env = { ...machine(), date: runDate, chunks: [...prev, { date: now, ...selection }] }
  } else if (!partial || !data.env) data.env = { ...machine(), date: now }
  else data.env.partialRuns = [...(data.env.partialRuns || []), { date: now, ...selection }].slice(-20)
}

module.exports = { read, update, applyEnv, now: () => new Date().toISOString() }
