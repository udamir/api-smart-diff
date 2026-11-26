import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { type CompatCase, type Placement, type SchemaCase, type VariantTag, runCases } from "../../helpers/compat"
import { aaIssues } from "./payload-schemas.issues"

// Every JSON Schema keyword case of test/compat/jsonschema/*.cases.ts re-run as an AsyncAPI message payload: 2.6
// publish (consumed, request semantics) / subscribe (produced, response semantics) and 3.0 receive / send, for the
// directions the case is written for. Case ids get the suffix `-AA`; expectations are the JSON Schema case's request /
// response expectations. Not re-run: `dialect: "3.0"` keywords (nullable, boolean exclusive bounds), the OpenAPI keyword
// area JS-OAS-* (xml, discriminator, readOnly / writeOnly request-response semantics) and cases written only for the
// param / header / json placements.

const dir = path.join(import.meta.dirname, "..", "jsonschema")

const caseFiles = fs
  .readdirSync(dir)
  .filter((file) => file.endsWith(".cases.ts"))
  .sort()

export const schemaCases: SchemaCase[] = (
  await Promise.all(caseFiles.map((file) => import(pathToFileURL(path.join(dir, file)).href)))
).flatMap((module) => module.cases as SchemaCase[])

export const openApiOnly = (c: SchemaCase) =>
  c.dialect === "3.0" ||
  c.id.startsWith("JS-OAS-") ||
  (!!c.placements && !c.placements.some((p) => p === "request" || p === "response"))

export const placementsOf = (c: SchemaCase): Placement[] => {
  const own = c.placements ?? ["request", "response"]
  return [
    ...(own.includes("request") ? (["aa2-pub", "aa3-receive"] as Placement[]) : []),
    ...(own.includes("response") ? (["aa2-sub", "aa3-send"] as Placement[]) : []),
  ]
}

// policy tags keyed by direction / "*" carry over; tags keyed by an OpenAPI placement name do not
const directional = (tag: VariantTag | undefined): VariantTag | undefined => {
  if (tag === undefined || typeof tag === "string") return tag
  const kept = Object.fromEntries(Object.entries(tag).filter(([k]) => k === "request" || k === "response" || k === "*"))
  return Object.keys(kept).length ? kept : undefined
}

export const aaCases = (): SchemaCase[] =>
  schemaCases
    .filter((c) => !openApiOnly(c))
    .map((c) => ({
      ...c,
      id: `${c.id}-AA`,
      placements: placementsOf(c),
      covers: [],
      issue: aaIssues[c.id],
      policy: directional(c.policy),
    }))

const cases: CompatCase[] = aaCases()

runCases("asyncapi-payload", "payload-schemas", cases, import.meta.filename)
