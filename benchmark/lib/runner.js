"use strict"
// Spawns scripts/run-case.js for one case, enforces the 60 s per-call timeout (the first call = probe) and a run budget
// derived from the probe, parses --trace-gc lines for the peak heap, and returns the result line.
const { spawn } = require("node:child_process")
const path = require("node:path")

const PER_CALL_TIMEOUT_MS = 60_000

const runCase = ({ adapter, fixture, mode = "timing", out, env = {} }) =>
  new Promise((resolve) => {
    const args = ["--expose-gc", "--max-old-space-size=8192", "--stack-size=4000", path.join(__dirname, "..", "scripts", "run-case.js"), "--adapter", adapter, "--fixture", fixture, "--mode", mode]
    if (out) args.push("--out", out)
    const child = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, ...env } })
    let buf = ""
    let stderr = ""
    let probe
    let result
    let timer
    let gcPeakMB = 0
    const started = Date.now()
    const kill = (status) => {
      clearTimeout(timer)
      child.kill("SIGKILL")
      result = { adapter, fixture, mode, status, elapsedMs: Date.now() - started, probeMs: probe?.ms }
    }
    timer = setTimeout(() => kill("timeout"), PER_CALL_TIMEOUT_MS)
    child.stdout.on("data", (d) => {
      buf += d
      let nl
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl)
        buf = buf.slice(nl + 1)
        if (!line.trim()) continue
        if (line[0] !== "{") {
          const g = line.match(/(?:Scavenge|Mark-Compact|Mark-sweep|Minor Mark-Sweep|Minor Mark-Compact)[^0-9]*([0-9]+(?:\.[0-9]+)?) \(/)
          if (g && Number(g[1]) > gcPeakMB) gcPeakMB = Number(g[1])
          continue
        }
        let msg
        try {
          msg = JSON.parse(line)
        } catch {
          continue
        }
        if (msg.phase === "probe") {
          probe = msg
          clearTimeout(timer)
          if (!msg.error) {
            const budget = Math.max(30_000, msg.ms * ((msg.warmups || 0) + (msg.runs || 0) + 1) * 3 + 20_000)
            timer = setTimeout(() => kill(mode === "timing" ? "timeout-budget" : "timeout"), budget)
          }
        } else if (msg.phase === "result") {
          clearTimeout(timer)
          result = { ...msg, status: msg.error ? "error" : "ok", elapsedMs: Date.now() - started }
          delete result.phase
          if (mode === "heap" && !msg.error) {
            result.gcPeakBytes = Math.round(gcPeakMB * 1048576)
            result.peakHeapBytes = Math.max(result.gcPeakBytes, result.heapAfterCallBytes || 0)
          }
        }
      }
    })
    child.stderr.on("data", (d) => {
      stderr += d
    })
    child.on("exit", (code, signal) => {
      clearTimeout(timer)
      if (!result) result = { adapter, fixture, mode, status: "crash", exitCode: code, signal, elapsedMs: Date.now() - started, error: { name: "ProcessExit", message: stderr.trim().split("\n").slice(-3).join(" | ").slice(0, 300) } }
      if (stderr.trim()) result.stderr = stderr.trim().slice(-400)
      resolve(result)
    })
  })

module.exports = { runCase, PER_CALL_TIMEOUT_MS }
