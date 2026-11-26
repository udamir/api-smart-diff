// Shared helpers of the compat family `protoapi` (PROTOAPI_DESIGN §9.2): case ids `PB-<AREA>-NNN`, one variant per
// compatibility level (`FILE`, `PACKAGE`, `WIRE_JSON`, `WIRE`), expectations written as the matrix cells of §6 in the
// order FILE PACKAGE WIRE_JSON WIRE. Not a test file: the case tables are the `*.test.ts` files of this folder.

import type { CaseSource, CompatCase, ExpectedType, ProtoCase } from "../../helpers/compat"

const letters: Record<string, ExpectedType> = {
  B: "breaking",
  R: "risky",
  N: "non-breaking",
  D: "deprecated",
  A: "annotation",
  U: "unclassified",
}

/** The cells of a matrix row ("B B B R", FILE PACKAGE WIRE_JSON WIRE) as a level-keyed expected type. */
export const cells = (row: string): Record<string, ExpectedType> => {
  const [file, pkg, wireJson, wire] = row.split(" ").map((cell) => {
    const type = letters[cell]
    if (!type) throw new Error(`unknown cell ${cell} in "${row}"`)
    return type
  })
  if (wire === undefined) throw new Error(`four cells expected in "${row}"`)
  return { FILE: file, PACKAGE: pkg, WIRE_JSON: wireJson, WIRE: wire }
}

/** A ProtoApi case; `single` (R-1: at most one record per element) is on unless the case says otherwise. */
export const proto = (c: Omit<ProtoCase, "kind">): CompatCase => ({ kind: "proto", single: true, ...c })

/** A case re-authored from a module of buf's breaking test corpus (v1.75.0), with buf's verdict per category. */
export const buf = (module: string, verdict?: string): CaseSource => ({
  tool: "buf",
  ref: `private/bufpkg/bufcheck/testdata/breaking/current/${module}`,
  ...(verdict ? { verdict } : {}),
})

/** One of the 26 buf v1.75 parity scenarios a … z of the protoapi study (`.tmp/buf-parity/mkscen.sh`). */
export const parity = (scenario: string, verdict?: string): CaseSource => ({
  tool: "buf",
  ref: `protoapi buf-parity scenario ${scenario}`,
  ...(verdict ? { verdict } : {}),
})

/** The row of the classification matrix (PROTOAPI_DESIGN §6) the case pins. */
export const row = (id: string): CaseSource => ({ tool: "asd", ref: `docs/PROTOAPI_DESIGN.md §6 ${id}` })

export const p3 = (body: string, imports = "") => `syntax = "proto3";\npackage p;\n${imports}${body}\n`
export const p2 = (body: string, imports = "") => `syntax = "proto2";\npackage p;\n${imports}${body}\n`
export const e23 = (body: string, imports = "") => `edition = "2023";\npackage p;\n${imports}${body}\n`
export const e24 = (body: string, imports = "") => `edition = "2024";\npackage p;\n${imports}${body}\n`

/** Path of a field of message `p.<message>`. */
export const field = (message: string, name: string) => `components/messages/p.${message}/properties/${name}`
