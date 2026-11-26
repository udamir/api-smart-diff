// The JSON Schema classification oracle (test/compat/oracle.ts) must not find a disagreement that is not listed with
// its reason in test/compat/coverage/jsonschema-oracle-exceptions.json, and no listed reason may be stale. The oracle
// runs in a child process: it collects the case tables with ASD_COMPAT_COLLECT, which must not leak into this runner.
// It needs ajv 8 (not a dependency of this package, see oracle.ts); without it the test is skipped.
// The buf oracle of the ProtoApi family (test/compat/protoapi/buf-oracle.ts, PROTOAPI_DESIGN §9.3) must agree with the
// checked-in buf v1.75 findings except the differences listed with their decision in
// test/compat/coverage/protoapi-buf-oracle-exceptions.json, and no listed difference may be stale; it needs protoapi only.

import { spawnSync } from "node:child_process"
import path from "node:path"

import { findAjv } from "../oracle"

const root = path.join(import.meta.dirname, "..", "..", "..")

describe("compat core / JSON Schema oracle", () => {
  it.skipIf(!findAjv())(
    "X-ORACLE-001 every set-inclusion disagreement of the JSON Schema cases is explained",
    () => {
      const run = spawnSync(
        process.execPath,
        ["--import", "vite-plus/register", path.join(root, "test", "compat", "oracle.ts"), "--json"],
        {
          cwd: root,
          encoding: "utf8",
          env: { ...process.env, ASD_COMPAT_COLLECT: "" },
        },
      )
      expect(run.status).toBe(0)
      const result = JSON.parse(run.stdout.trim().split("\n").pop() as string)
      expect({ unexplained: result.unexplained, stale: result.stale }).toEqual({ unexplained: [], stale: [] })
      expect(result.summary.agree).toBeGreaterThan(500)
    },
    60_000,
  )
})

describe("compat core / ProtoApi buf oracle", () => {
  it("X-ORACLE-002 every disagreement with buf breaking is explained by a decision, no exception is stale", () => {
    const run = spawnSync(
      process.execPath,
      ["--import", "vite-plus/register", path.join(root, "test", "compat", "protoapi", "buf-oracle.ts"), "--json"],
      { cwd: root, encoding: "utf8", env: { ...process.env, ASD_COMPAT_COLLECT: "" } },
    )
    expect(run.status).toBe(0)
    const result = JSON.parse(run.stdout.trim().split("\n").pop() as string)
    expect({ problems: result.problems, unexplained: result.unexplained, stale: result.stale }).toEqual({
      problems: [],
      unexplained: [],
      stale: [],
    })
    // every category is checked, and most findings agree
    for (const category of ["FILE", "PACKAGE", "WIRE_JSON", "WIRE"]) {
      expect(result.summary[category].agree).toBeGreaterThan(300)
    }
  }, 120_000)
})
