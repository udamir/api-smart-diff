"use strict"
// GraphQL fixtures: the GitHub public schema (fixtures/vendor/github.graphql, `npm run fetch`) with a scripted change
// set made on the SDL AST, the repository pair test/resources/schema-before.graphql / schema-after.graphql, and an
// identical pair. Each fixture yields SDL; scripts/fixtures.js converts it per variant (gqlapi 0.5.1 GraphApi 0.1.2
// documents for 1.0.6, gqlapi 0.6.0 GraphApi 1.0 documents for 2.0.0, the fork graphapi for the fork, SDL for
// graphql-inspector and graphql-js).
//
// Semantics: GraphQL clients select output fields and supply arguments / input fields. Removing an output field,
// argument, enum value or root field, making an output field nullable, adding a required argument / input field,
// making an argument non-null or changing a field's type is breaking; the opposite directions are non-breaking
// (graphql-inspector's criticality model and the GraphQL spec's schema-evolution guidance agree on all of these).
const fs = require("node:fs")
const path = require("node:path")
const { parse, print, Kind } = require("graphql")
const P = require("../scripts/paths")

const githubSdl = () => fs.readFileSync(P.GITHUB_GRAPHQL, "utf8")

const named = (n) => ({ kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: n } })
const nonNull = (t) => ({ kind: Kind.NON_NULL_TYPE, type: t })
const nameNode = (v) => ({ kind: Kind.NAME, value: v })
const fieldDef = (name, type, args = []) => ({ kind: Kind.FIELD_DEFINITION, name: nameNode(name), arguments: args, type, directives: [] })
const inputValue = (name, type) => ({ kind: Kind.INPUT_VALUE_DEFINITION, name: nameNode(name), type, directives: [] })
const isScalarNamed = (t, names) => t.kind === Kind.NAMED_TYPE && names.includes(t.name.value)

const githubChangeSet = () => {
  const doc = parse(githubSdl(), { noLocation: true })
  const defs = doc.definitions
  const objects = defs.filter((d) => d.kind === Kind.OBJECT_TYPE_DEFINITION)
  const inputs = defs.filter((d) => d.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION)
  const enums = defs.filter((d) => d.kind === Kind.ENUM_TYPE_DEFINITION)
  // every identifier (types, fields, args, input fields, enum values), lower-cased, with its count
  const ids = new Map()
  const add = (n) => ids.set(n.toLowerCase(), (ids.get(n.toLowerCase()) || 0) + 1)
  for (const d of defs) {
    if (d.name) add(d.name.value)
    for (const f of d.fields || []) {
      add(f.name.value)
      for (const a of f.arguments || []) add(a.name.value)
    }
    for (const v of d.values || []) add(v.name.value)
  }
  const idList = [...ids.keys()]
  // unique: occurs once and is not a substring of another identifier (so token matching cannot over-match)
  const unique = (n) => {
    const l = n.toLowerCase()
    return ids.get(l) === 1 && l.length >= 8 && !idList.some((o) => o !== l && o.includes(l))
  }
  const used = new Set()
  const pickField = (types, pred, what) => {
    for (const t of types) {
      if (t.name.value === "Query" && what !== "Q11") continue
      if (t.name.value === "Mutation" || used.has(t.name.value)) continue
      for (const f of t.fields || []) {
        if (unique(f.name.value) && pred(f, t)) {
          used.add(t.name.value)
          return { t, f }
        }
      }
    }
    throw new Error(`graphql change set: no target for ${what}`)
  }
  const scalars = ["String", "Int", "Boolean", "Float"]
  const expected = []
  const tok = (n) => n.toLowerCase()

  { const { t, f } = pickField(objects, () => true, "Q1"); t.fields = t.fields.filter((x) => x !== f); expected.push({ id: "Q1", what: `${t.name.value}.${f.name.value} (output field) removed`, class: "breaking", tokens: [tok(f.name.value)] }) }
  { const { t } = pickField(objects, () => true, "Q2"); t.fields.push(fieldDef("benchAddedField", named("String"))); expected.push({ id: "Q2", what: `${t.name.value}.benchAddedField added`, class: "non-breaking", tokens: ["benchaddedfield"] }) }
  { const { t, f } = pickField(objects, (x) => (x.arguments || []).length === 0, "Q3"); f.arguments = [inputValue("benchRequiredArg", nonNull(named("Int")))]; expected.push({ id: "Q3", what: `${t.name.value}.${f.name.value} gains required argument`, class: "breaking", tokens: [["benchrequiredarg", tok(f.name.value)]] }) }
  { const { t, f } = pickField(objects, (x) => (x.arguments || []).length === 0, "Q4"); f.arguments = [inputValue("benchOptionalArg", named("Int"))]; expected.push({ id: "Q4", what: `${t.name.value}.${f.name.value} gains optional argument`, class: "non-breaking", tokens: [["benchoptionalarg", tok(f.name.value)]] }) }
  { const { t, f } = pickField(objects, (x) => isScalarNamed(x.type, scalars) && (x.arguments || []).length === 0, "Q5"); f.type = nonNull(f.type); expected.push({ id: "Q5", what: `${t.name.value}.${f.name.value} nullable -> non-null (output)`, class: "non-breaking", tokens: [tok(f.name.value)] }) }
  { const { t, f } = pickField(objects, (x) => x.type.kind === Kind.NON_NULL_TYPE && isScalarNamed(x.type.type, scalars) && (x.arguments || []).length === 0, "Q6"); f.type = f.type.type; expected.push({ id: "Q6", what: `${t.name.value}.${f.name.value} non-null -> nullable (output)`, class: "breaking", tokens: [tok(f.name.value)] }) }
  { const { t, f } = pickField(objects, (x) => (x.arguments || []).some((a) => a.type.kind === Kind.NAMED_TYPE && !a.defaultValue), "Q7"); const a = f.arguments.find((x) => x.type.kind === Kind.NAMED_TYPE && !x.defaultValue); a.type = nonNull(a.type); expected.push({ id: "Q7", what: `${t.name.value}.${f.name.value}(${a.name.value}) nullable -> non-null`, class: "breaking", tokens: [tok(f.name.value)] }) }
  { const { t, f } = pickField(objects, (x) => (x.arguments || []).length >= 2, "Q8"); const a = f.arguments[f.arguments.length - 1]; f.arguments = f.arguments.slice(0, -1); expected.push({ id: "Q8", what: `${t.name.value}.${f.name.value} argument ${a.name.value} removed`, class: "breaking", tokens: [tok(f.name.value)] }) }
  {
    const e = enums.find((x) => !used.has(x.name.value) && x.values.length >= 3 && x.values.some((v) => unique(v.name.value)))
    const v = e.values.find((x) => unique(x.name.value))
    e.values = e.values.filter((x) => x !== v)
    used.add(e.name.value)
    // graphql-js findBreakingChanges and graphql-inspector: always breaking; scope-aware tools treat an output-only enum
    // like a response enum (a value that can no longer be returned breaks nobody), so non-breaking is accepted too
    expected.push({ id: "Q9", what: `enum ${e.name.value} value ${v.name.value} removed`, class: "breaking", accept: ["non-breaking"], tokens: [tok(v.name.value)] })
  }
  {
    const e = enums.find((x) => !used.has(x.name.value) && x.values.length >= 2 && unique(x.name.value))
    e.values.push({ kind: Kind.ENUM_VALUE_DEFINITION, name: nameNode("BENCH_NEW_VALUE"), directives: [] })
    used.add(e.name.value)
    expected.push({ id: "Q10", what: `enum ${e.name.value} value BENCH_NEW_VALUE added`, class: "risky", accept: ["non-breaking", "breaking"], tokens: ["bench_new_value"] })
  }
  {
    const q = objects.find((x) => x.name.value === "Query")
    const f = q.fields.find((x) => unique(x.name.value))
    q.fields = q.fields.filter((x) => x !== f)
    expected.push({ id: "Q11", what: `Query.${f.name.value} (root field) removed`, class: "breaking", tokens: [tok(f.name.value)] })
  }
  {
    const m = objects.find((x) => x.name.value === "Mutation")
    m.fields.push(fieldDef("benchMutation", named("String"), [inputValue("benchInput", named("Int"))]))
    expected.push({ id: "Q12", what: "Mutation.benchMutation added", class: "non-breaking", tokens: ["benchmutation"] })
  }
  {
    const { t, f } = pickField(objects, (x) => !(x.directives || []).some((d) => d.name.value === "deprecated"), "Q13")
    f.directives = [...(f.directives || []), { kind: Kind.DIRECTIVE, name: nameNode("deprecated"), arguments: [{ kind: Kind.ARGUMENT, name: nameNode("reason"), value: { kind: Kind.STRING, value: "bench" } }] }]
    expected.push({ id: "Q13", what: `${t.name.value}.${f.name.value} deprecated`, class: "deprecated", accept: ["non-breaking", "annotation"], tokens: [tok(f.name.value)] })
  }
  {
    const { t, f } = pickField(objects, (x) => !!x.description, "Q14")
    f.description = { kind: Kind.STRING, value: `${f.description.value} (bench)`, block: true }
    expected.push({ id: "Q14", what: `${t.name.value}.${f.name.value} description changed`, class: "annotation", tokens: [tok(f.name.value)] })
  }
  {
    const i = inputs.find((x) => !used.has(x.name.value) && unique(x.name.value))
    used.add(i.name.value)
    i.fields.push(inputValue("benchRequiredInput", nonNull(named("Int"))))
    expected.push({ id: "Q15", what: `input ${i.name.value} gains required field`, class: "breaking", tokens: ["benchrequiredinput"] })
    const j = inputs.find((x) => !used.has(x.name.value) && unique(x.name.value))
    used.add(j.name.value)
    j.fields.push(inputValue("benchOptionalInput", named("Int")))
    expected.push({ id: "Q16", what: `input ${j.name.value} gains optional field`, class: "non-breaking", tokens: ["benchoptionalinput"] })
  }
  { const { t, f } = pickField(objects, (x) => isScalarNamed(x.type, ["String"]) && (x.arguments || []).length === 0, "Q17"); f.type = named("Int"); expected.push({ id: "Q17", what: `${t.name.value}.${f.name.value} String -> Int (output)`, class: "breaking", tokens: [tok(f.name.value)] }) }
  {
    defs.push({ kind: Kind.OBJECT_TYPE_DEFINITION, name: nameNode("BenchNewType"), interfaces: [], directives: [], fields: [fieldDef("benchNewTypeField", named("String"))] })
    expected.push({ id: "Q18", what: "type BenchNewType added (unreferenced)", class: "non-breaking", optional: true, tokens: [["benchnewtype"]] })
  }
  return { sdlBefore: githubSdl(), sdlAfter: print(doc), expected }
}

const repoExpected = () => [
  { id: "R1", what: "Query2.continents [Continent]! -> [Continent] (output)", class: "breaking", tokens: ["continents"] },
  { id: "R2", what: "Country.code ID -> String", class: "breaking", tokens: ["country", "code"], not: ["language", "continent/", "continents"] },
  { id: "R3", what: "Country.states description changed", class: "annotation", tokens: ["states", "description"] },
  { id: "R4", what: "Language.code ID -> String", class: "breaking", tokens: ["language", "code"] },
  { id: "R5", what: "Tweet.id ID! -> ID (output)", class: "breaking", tokens: ["tweet", "id"], not: ["notification", "/user/", "meta/", "/stats/"] },
  { id: "R6", what: "Stat.responses added", class: "non-breaking", tokens: ["responses"] },
  { id: "R7", what: "Query.NotificationsMeta removed", class: "breaking", tokens: ["notificationsmeta"] },
]

const fixtures = [
  { name: "gql-github", family: "graphql", spec: "graphql", kind: "changeset", group: "large", desc: "GitHub public GraphQL schema (1.1 MB SDL), 18 scripted changes", generate: githubChangeSet },
  { name: "gql-github-identical", family: "graphql", spec: "graphql", kind: "identical", group: "large", desc: "GitHub public GraphQL schema compared with itself", generate: () => ({ sdlBefore: githubSdl(), sdlAfter: githubSdl() }) },
  {
    name: "gql-repo-pair",
    family: "graphql",
    spec: "graphql",
    kind: "changeset",
    desc: "test/resources/schema-before.graphql -> schema-after.graphql (7 changes + comment edits and field reorders that are not changes)",
    generate: () => ({ sdlBefore: fs.readFileSync(path.join(P.ASD_RESOURCES, "schema-before.graphql"), "utf8"), sdlAfter: fs.readFileSync(path.join(P.ASD_RESOURCES, "schema-after.graphql"), "utf8"), expected: repoExpected() }),
  },
]

module.exports = { fixtures }
