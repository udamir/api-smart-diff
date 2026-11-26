"use strict"
// Worker: runs ONE (adapter, fixture) case in its own process and reports JSON lines on stdout.
//   node --expose-gc scripts/run-case.js --adapter <id> --fixture <name> --mode timing|heap|quality [--out <file>]
// Protocol: a {"phase":"probe"} line after the first call (the parent then replaces the 60 s per-call timeout by a run
// budget), then one {"phase":"result"} line. In heap mode --trace-gc lines are printed on stdout as well (parsed by
// lib/runner.js for the peak).
//
// timing: probe call -> warm-up calls -> timed runs. warm-ups = 20, reduced only when 20 calls would exceed the 60 s
//   warm-up budget (then floor(60 s / probe), at least 2); runs = 11 when the probe is < 100 ms, otherwise 7. Every
//   call gets fresh inputs built by adapter.prepare() before the clock starts (api-smart-diff 1.0.6 mutates
//   its inputs), with gc() before each timed call.
// heap:   3 warm-ups, then one call with the output kept alive: peak = max heap used before any GC during the call and
//   heapUsed right after it; retained = heapUsed after the call with inputs dropped and gc settled, minus heapUsed
//   before the inputs were built.
// quality: one call; normalized diffs written to --out; input mutation check; merged document presence.
const fs = require("node:fs")
const path = require("node:path")
const v8 = require("node:v8")
const { isDeepStrictEqual } = require("node:util")
const A = require("../adapters")
const F = require("../fixtures")

const args = {}
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, "")] = process.argv[i + 1]
const emit = (obj) => process.stdout.write(`${JSON.stringify(obj)}\n`)
const gc = () => global.gc && global.gc()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const settle = async () => {
  for (let i = 0; i < 3; i++) {
    gc()
    await sleep(30)
  }
}
const errorInfo = (e) => ({ name: e?.constructor ? e.constructor.name : "Error", message: String(e?.message ? e.message : e).split("\n")[0].slice(0, 300) })
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const adapter = A.get(args.adapter)
const fx = F.get(args.fixture)
const mode = args.mode || "timing"
const format = adapter.format(fx)
const WARMUP_BUDGET_MS = Number(process.env.BENCH_WARMUP_BUDGET_MS || 60000)
const WARMUPS = Number(process.env.BENCH_WARMUP || 20)

const timed = async (fn) => {
  const t0 = process.hrtime.bigint()
  let out = fn()
  if (out && typeof out.then === "function") out = await out
  return { ms: Number(process.hrtime.bigint() - t0) / 1e6, out }
}

const main = async () => {
  const lib = adapter.setup()
  const before = F.readInput(fx.name, "before", format)
  const after = F.readInput(fx.name, "after", format)
  const fresh = () => adapter.prepare(lib, before, after, fx)
  const call = (input) => adapter.run(lib, input, fx)
  const base = { adapter: adapter.id, fixture: fx.name, mode, format }

  if (mode === "heap") {
    let slowest = 0
    // up to 3 warm-ups; a call slower than 5 s is not repeated (the measured call follows directly)
    for (let i = 0; i < 3 && slowest < 5000; i++) slowest = Math.max(slowest, (await timed(() => call(fresh()))).ms)
    // the first warm-up ran under the parent's 60 s per-call timeout; the rest of the case gets a budget from it
    emit({ phase: "probe", ms: slowest, warmups: 0, runs: 1 })
    await settle()
    const hStart = process.memoryUsage().heapUsed
    let input = fresh()
    await settle()
    const heapBeforeCall = process.memoryUsage().heapUsed
    v8.setFlagsFromString("--trace-gc")
    const r = await timed(() => call(input))
    const heapAfterCall = process.memoryUsage().heapUsed
    v8.setFlagsFromString("--notrace-gc")
    input = null
    await settle()
    const retained = process.memoryUsage().heapUsed - hStart
    emit({ phase: "result", ...base, callMs: r.ms, inputHeapBytes: heapBeforeCall - hStart, heapBeforeCallBytes: heapBeforeCall, heapAfterCallBytes: heapAfterCall, heapRetainedBytes: retained, keep: typeof r.out })
    return
  }

  if (mode === "quality") {
    const input = fresh()
    let snapshot
    try {
      // GraphQLSchema inputs (graphql-inspector) cannot be cloned; the mutation check is n/a for them
      snapshot = structuredClone(input)
    } catch {
      snapshot = undefined
    }
    // no probe line: the single call runs under the parent's 60 s per-call timeout
    const r = await timed(() => call(input))
    const diffs = adapter.normalize(r.out, fx)
    const merged = adapter.merged ? adapter.merged(r.out) : undefined
    let mutated = false
    try {
      mutated = snapshot === undefined ? "n/a" : !isDeepStrictEqual(snapshot, input)
    } catch {
      mutated = "n/a"
    }
    if (args.out) {
      fs.mkdirSync(path.dirname(args.out), { recursive: true })
      fs.writeFileSync(args.out, JSON.stringify(diffs))
    }
    emit({ phase: "result", ...base, callMs: r.ms, diffs: diffs.length, mutatedInput: mutated, mergedDocument: merged !== undefined && merged !== null && typeof merged === "object" })
    return
  }

  // timing
  let probe
  try {
    const input = fresh()
    gc()
    probe = await timed(() => call(input))
  } catch (e) {
    emit({ phase: "probe", error: errorInfo(e) })
    emit({ phase: "result", ...base, error: errorInfo(e) })
    return
  }
  const probeMs = probe.ms
  let diffCount
  try {
    diffCount = adapter.normalize(probe.out, fx).length
  } catch {}
  probe = null
  const warmups = Math.max(2, Math.min(WARMUPS, Math.floor(WARMUP_BUDGET_MS / Math.max(probeMs, 1))))
  const runs = probeMs < 100 ? 11 : 7
  emit({ phase: "probe", ms: probeMs, warmups, runs })
  for (let i = 0; i < warmups; i++) await call(fresh())
  const times = []
  for (let i = 0; i < runs; i++) {
    const input = fresh()
    gc()
    const r = await timed(() => call(input))
    times.push(r.ms)
  }
  emit({ phase: "result", ...base, probeMs, warmups, runs, times, medianMs: median(times), minMs: Math.min(...times), diffs: diffCount })
}

main().catch((e) => emit({ phase: "result", adapter: adapter.id, fixture: fx.name, mode, error: errorInfo(e) }))
