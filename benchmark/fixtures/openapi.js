"use strict"
// OpenAPI fixtures: the repository's petstore with a hand-written change set (also as 3.1 and 3.2 documents), the
// GitHub REST API description with a scripted realistic change set, identical-document pairs, and the synthetic
// scaling / direction / combinator documents of test/performance.test.ts at larger sizes.
//
// Every change-set fixture returns `expected`: one entry per scripted change with
//   class   - the expected classification, grounded in OAS semantics (consumer viewpoint: a change is breaking when an
//             existing client that follows the before document can fail against the after document)
//   accept  - further classifications that are also counted as agreement (genuinely debatable cases only)
//   tokens  - substrings that ALL must occur in a tool diff's normalized haystack for the diff to be attributed to this
//             change (a token may be an array of alternatives); `not` - substrings that must not occur
//   optional - the change may legitimately produce no diff (not counted in recall when absent)
// Haystacks are lower-cased and contain canonical operation keys `@op:METHOD /path@` and `@path:/path@` (see adapters).
const fs = require("node:fs")
const path = require("node:path")
const yaml = require("js-yaml")
const P = require("../scripts/paths")

const clone = (v) => structuredClone(v)
const op = (m, p) => `@op:${m.toLowerCase()} ${p.toLowerCase()}@`
const pathTok = (p) => `@path:${p.toLowerCase()}@`
// a property name as it appears in the path / text of the different tools (pointer segment, backticks, JSONPath)
// coarse sites for schema-granular tools (openapi-diff): the request body / response of an operation that uses a
// changed component; only used for adapters flagged `coarse`
const site = (m, p, part) => [op(m, p), part]
const PET_SITES = [site("put", "/pet", "requestbody"), site("post", "/pet", "requestbody"), site("get", "/pet/findByStatus", "responses"), site("get", "/pet/findByTags", "responses"), site("get", "/pet/{petId}", "responses")]
const APIRESPONSE_SITES = [site("post", "/pet/{petId}/uploadImage", "responses")]
const USER_SITES = [site("post", "/user", "requestbody"), site("post", "/user/createWithArray", "requestbody"), site("post", "/user/createWithList", "requestbody"), site("get", "/user/{username}", "responses"), site("put", "/user/{username}", "requestbody"), site("get", "/user/{handle}", "responses"), site("put", "/user/{handle}", "requestbody")]
const ORDER_SITES = [site("post", "/store/order", "requestbody"), site("post", "/store/order", "responses"), site("get", "/store/order/{orderId}", "responses")]
const propTok = (n) => [`/${n}/`, `\`${n}\``, `['${n}']`, `.${n}.`].map((s) => s.toLowerCase())

const loadPetstore = () => yaml.load(fs.readFileSync(path.join(P.ASD_RESOURCES, "petstore.yaml"), "utf8"))

// base patch applied to BOTH sides: gives every scripted change a uniquely named anchor and adds the constructs some
// changes need (a 5XX response with content, a maxLength bound)
const petstoreBase = () => {
  const d = loadPetstore()
  d.paths["/pet"].put.responses["5XX"] = {
    description: "Internal Server Error",
    content: { "application/json": { schema: { type: "object", properties: { errorCode: { type: "integer" } } } } },
  }
  const ar = d.components.schemas.ApiResponse
  ar.properties = { resultCode: ar.properties.code, type: ar.properties.type, message: ar.properties.message }
  const login = d.paths["/user/login"].get.parameters
  login[0].name = "loginName"
  d.components.schemas.User.properties.phone.maxLength = 64
  d.paths["/store/inventory"].get.parameters = [{ name: "region", in: "query", required: false, schema: { type: "string", enum: ["eu", "us"] } }]
  return d
}

const petstoreAfter = (base) => {
  const d = clone(base)
  // P1 remove operation
  delete d.paths["/store/order/{orderId}"].delete
  // P2 add path
  d.paths["/store/benchReport"] = {
    get: { summary: "Bench report", operationId: "benchReport", responses: { 200: { description: "ok", content: { "application/json": { schema: { type: "object" } } } } } },
  }
  // P3 required property on a request+response component
  d.components.schemas.Pet.required.push("benchTag")
  d.components.schemas.Pet.properties.benchTag = { type: "string" }
  // P4 type change of a response-only component property
  d.components.schemas.ApiResponse.properties.resultCode = { type: "string" }
  // P5 optional property on a response-only component
  d.components.schemas.ApiResponse.properties.traceId = { type: "string" }
  // P6 required property on a response-only component
  d.components.schemas.ApiResponse.properties.requestStamp = { type: "string" }
  d.components.schemas.ApiResponse.required = ["requestStamp"]
  // P7 change inside an uppercase range response code
  d.paths["/pet"].put.responses["5XX"].content["application/json"].schema.properties.errorCode = { type: "string" }
  // P8 new required query parameter
  d.paths["/user/login"].get.parameters.push({ name: "benchOtp", in: "query", required: true, schema: { type: "string" } })
  // P9 new optional query parameter
  d.paths["/pet/findByStatus"].get.parameters.push({ name: "benchLimit", in: "query", required: false, schema: { type: "integer" } })
  // P10 query parameter type change
  d.paths["/user/login"].get.parameters[0].schema = { type: "integer" }
  // P11 / P12 enum value removed / added in a request parameter
  const statusItems = d.paths["/pet/findByStatus"].get.parameters[0].schema.items
  statusItems.enum = ["available", "pending"]
  d.paths["/store/inventory"].get.parameters[0].schema.enum = ["eu", "us", "apac"]
  // P13 explicit explode change on a form-style query parameter
  d.paths["/pet/findByTags"].get.parameters[0].explode = false
  // P14 path template parameter renamed
  const userPath = d.paths["/user/{username}"]
  delete d.paths["/user/{username}"]
  for (const m of Object.keys(userPath)) for (const prm of userPath[m].parameters || []) if (prm.in === "path") prm.name = "handle"
  d.paths["/user/{handle}"] = userPath
  // P15 required request body added
  d.paths["/pet/{petId}"].delete.requestBody = {
    required: true,
    content: { "application/json": { schema: { type: "object", required: ["reason"], properties: { reason: { type: "string" } } } } },
  }
  // P16 security requirement added to an operation that used the global api_key requirement
  d.paths["/store/order"].post.security = [{ petstore_auth: ["write:pets"] }]
  // P17 summary changed
  d.paths["/pet"].put.summary = "Update an existing pet (bench)"
  // P18 operation deprecated
  d.paths["/user/login"].get.deprecated = true
  // P19 maxLength tightened on a request+response property
  d.components.schemas.User.properties.phone.maxLength = 32
  // P20 response media type removed
  delete d.paths["/user/login"].get.responses["200"].content["application/xml"]
  // P21 response code added
  d.paths["/store/inventory"].get.responses["429"] = { description: "Too many requests" }
  // P22 response header renamed by case only
  const headers = d.paths["/user/login"].get.responses["200"].headers
  d.paths["/user/login"].get.responses["200"].headers = { "x-rate-limit": headers["X-Rate-Limit"], "X-Expires-After": headers["X-Expires-After"] }
  // P23 optional property on a request+response component
  d.components.schemas.Order.properties.giftNote = { type: "string" }
  // P24 required property removed from a request+response component
  delete d.components.schemas.Pet.properties.photoUrls
  d.components.schemas.Pet.required = d.components.schemas.Pet.required.filter((k) => k !== "photoUrls")
  return d
}

const petstoreExpected = () => [
  { id: "P1", what: "DELETE /store/order/{orderId} removed", class: "breaking", tokens: [op("delete", "/store/order/{orderId}")] },
  { id: "P2", what: "GET /store/benchReport added", class: "non-breaking", tokens: [pathTok("/store/benchReport")] },
  { id: "P3", what: "Pet (request+response) gains required property benchTag", class: "breaking", tokens: ["benchtag"], sites: PET_SITES },
  { id: "P4", what: "ApiResponse (response-only) resultCode integer -> string", class: "breaking", tokens: ["resultcode"], sites: APIRESPONSE_SITES },
  { id: "P5", what: "ApiResponse (response-only) gains optional property traceId", class: "non-breaking", tokens: ["traceid"], sites: APIRESPONSE_SITES },
  { id: "P6", what: "ApiResponse (response-only) gains required property requestStamp", class: "non-breaking", tokens: ["requeststamp"], sites: APIRESPONSE_SITES },
  { id: "P7", what: "PUT /pet 5XX response errorCode integer -> string", class: "breaking", tokens: ["errorcode"], sites: [site("put", "/pet", "5xx")] },
  { id: "P8", what: "GET /user/login new required query parameter benchOtp", class: "breaking", tokens: ["benchotp"] },
  { id: "P9", what: "GET /pet/findByStatus new optional query parameter benchLimit", class: "non-breaking", tokens: ["benchlimit"] },
  { id: "P10", what: "GET /user/login query parameter loginName string -> integer", class: "breaking", tokens: [op("get", "/user/login")], not: ["benchotp", "deprecated", "x-rate-limit", "application/xml"] },
  { id: "P11", what: "GET /pet/findByStatus status enum value 'sold' removed", class: "breaking", tokens: [op("get", "/pet/findByStatus"), "sold"] },
  { id: "P12", what: "GET /store/inventory region enum value 'apac' added", class: "non-breaking", tokens: [op("get", "/store/inventory"), "apac"] },
  { id: "P13", what: "GET /pet/findByTags tags explode true -> false", class: "breaking", tokens: [op("get", "/pet/findByTags"), "explode"] },
  { id: "P14", what: "/user/{username} -> /user/{handle} (path template parameter renamed)", class: "annotation", accept: ["non-breaking"], optional: true, tokens: ["handle"], not: ["phone", "maxlength"] },
  { id: "P15", what: "DELETE /pet/{petId} gains a required request body", class: "breaking", tokens: [op("delete", "/pet/{petId}")] },
  { id: "P16", what: "POST /store/order requires petstore_auth instead of the global api_key", class: "breaking", tokens: [op("post", "/store/order"), "security"] },
  { id: "P17", what: "PUT /pet summary changed", class: "annotation", tokens: [op("put", "/pet"), "summary"] },
  { id: "P18", what: "GET /user/login deprecated", class: "deprecated", accept: ["non-breaking", "annotation"], tokens: ["deprecated"] },
  { id: "P19", what: "User (request+response) phone maxLength 64 -> 32", class: "breaking", tokens: ["phone"], sites: USER_SITES },
  { id: "P20", what: "GET /user/login 200 response media type application/xml removed", class: "breaking", tokens: [op("get", "/user/login"), "application/xml"] },
  { id: "P21", what: "GET /store/inventory 429 response added", class: "non-breaking", tokens: [op("get", "/store/inventory"), "429"] },
  { id: "P22", what: "GET /user/login response header X-Rate-Limit -> x-rate-limit (case only)", class: "annotation", accept: ["non-breaking"], optional: true, tokens: ["x-rate-limit"] },
  { id: "P23", what: "Order (request+response) gains optional property giftNote", class: "non-breaking", tokens: ["giftnote"], sites: ORDER_SITES },
  { id: "P24", what: "Pet (request+response) required property photoUrls removed", class: "breaking", tokens: ["photourls"], sites: PET_SITES },
]

const withVersion = (doc, v) => ({ ...doc, openapi: v })

// ---- GitHub REST API description with a scripted change set ----
const METHODS = ["get", "put", "post", "delete", "patch"]
const loadGithub = () => JSON.parse(fs.readFileSync(path.join(P.VENDOR, "github-api.json"), "utf8"))

const githubChangeSet = () => {
  const before = loadGithub()
  const after = clone(before)
  const used = new Set()
  const paths = Object.keys(before.paths).sort()
  const ops = []
  for (const p of paths) for (const m of METHODS) if (before.paths[p][m]) ops.push({ p, m })
  const take = (pred, what) => {
    const found = ops.find((o) => !used.has(o.p) && pred(before.paths[o.p][o.m], o))
    if (!found) throw new Error(`github change set: no target for ${what}`)
    used.add(found.p)
    return found
  }
  const A = (o) => after.paths[o.p][o.m]
  const expected = []
  const inlineQuery = (opObj, f) => (opObj.parameters || []).some((x) => !x.$ref && x.in === "query" && f(x))
  const jsonBody = (opObj) => opObj.requestBody?.content?.["application/json"]?.schema
  const inlineBody = (opObj) => {
    const s = jsonBody(opObj)
    return s && !s.$ref && s.type === "object" && s.properties && Object.keys(s.properties).length >= 2 ? s : undefined
  }

  // G1 remove one operation of a multi-operation path
  {
    const o = take((x, { p, m }) => m === "delete" && METHODS.filter((k) => before.paths[p][k]).length > 1, "G1")
    delete after.paths[o.p][o.m]
    expected.push({ id: "G1", what: `${o.m.toUpperCase()} ${o.p} removed`, class: "breaking", tokens: [op(o.m, o.p)] })
  }
  // G2 remove a whole single-operation path
  {
    const o = take((x, { p }) => METHODS.filter((k) => before.paths[p][k]).length === 1, "G2")
    delete after.paths[o.p]
    expected.push({ id: "G2", what: `path ${o.p} removed`, class: "breaking", tokens: [pathTok(o.p)] })
  }
  // G3 add a path
  after.paths["/bench/new-endpoint"] = {
    get: { summary: "Bench endpoint", operationId: "bench/new-endpoint", responses: { 200: { description: "Response", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" } } } } } } } },
  }
  expected.push({ id: "G3", what: "GET /bench/new-endpoint added", class: "non-breaking", tokens: [pathTok("/bench/new-endpoint")] })
  // G4 add an operation to an existing path
  {
    const o = take((x, { p }) => !before.paths[p].put && METHODS.filter((k) => before.paths[p][k]).length === 1 && x.responses?.["200"], "G4")
    after.paths[o.p].put = { summary: "Bench put", operationId: "bench/put", responses: { 204: { description: "Response" } } }
    expected.push({ id: "G4", what: `PUT ${o.p} added`, class: "non-breaking", tokens: [op("put", o.p)] })
  }
  // G5 rename an optional inline query parameter
  {
    const o = take((x) => inlineQuery(x, (q) => !q.required && q.schema?.type === "string" && !q.schema.enum), "G5")
    const q = A(o).parameters.find((x) => !x.$ref && x.in === "query" && !x.required && x.schema?.type === "string" && !x.schema.enum)
    const old = q.name
    q.name = `${old}_renamed`
    expected.push({ id: "G5", what: `${o.m.toUpperCase()} ${o.p} optional query parameter ${old} renamed`, class: "breaking", accept: ["risky"], tokens: [op(o.m, o.p)] })
  }
  // G6 optional inline query parameter becomes required
  {
    const o = take((x) => inlineQuery(x, (q) => !q.required && q.schema?.type === "string" && !q.schema.enum), "G6")
    const q = A(o).parameters.find((x) => !x.$ref && x.in === "query" && !x.required && x.schema?.type === "string" && !x.schema.enum)
    q.required = true
    expected.push({ id: "G6", what: `${o.m.toUpperCase()} ${o.p} query parameter ${q.name} becomes required`, class: "breaking", tokens: [op(o.m, o.p)] })
  }
  // G7 new required query parameter
  {
    const o = take((x, { m }) => m === "get" && (x.parameters || []).length >= 1, "G7")
    A(o).parameters.push({ name: "bench_required", in: "query", required: true, schema: { type: "string" } })
    expected.push({ id: "G7", what: `${o.m.toUpperCase()} ${o.p} new required query parameter`, class: "breaking", tokens: [op(o.m, o.p)] })
  }
  // G8 new optional query parameter
  {
    const o = take((x, { m }) => m === "get" && (x.parameters || []).length >= 1, "G8")
    A(o).parameters.push({ name: "bench_optional", in: "query", required: false, schema: { type: "string" } })
    expected.push({ id: "G8", what: `${o.m.toUpperCase()} ${o.p} new optional query parameter`, class: "non-breaking", tokens: [op(o.m, o.p)] })
  }
  // G9 required property added to an inline request body
  {
    const o = take((x) => !!inlineBody(x), "G9")
    const s = jsonBody(A(o))
    s.properties.bench_required_field = { type: "string" }
    s.required = [...(s.required || []), "bench_required_field"]
    expected.push({ id: "G9", what: `${o.m.toUpperCase()} ${o.p} request body gains required property`, class: "breaking", tokens: [op(o.m, o.p)] })
  }
  // G10 optional property added to an inline request body
  {
    const o = take((x) => !!inlineBody(x), "G10")
    jsonBody(A(o)).properties.bench_optional_field = { type: "string" }
    expected.push({ id: "G10", what: `${o.m.toUpperCase()} ${o.p} request body gains optional property`, class: "non-breaking", tokens: [op(o.m, o.p)] })
  }
  // G11 request body property type change string -> integer
  {
    const o = take((x) => {
      const s = inlineBody(x)
      return s && Object.values(s.properties).some((v) => v.type === "string" && !v.enum)
    }, "G11")
    const s = jsonBody(A(o))
    const k = Object.keys(s.properties).find((key) => s.properties[key].type === "string" && !s.properties[key].enum)
    s.properties[k] = { ...s.properties[k], type: "integer" }
    delete s.properties[k].format
    delete s.properties[k].pattern
    delete s.properties[k].maxLength
    delete s.properties[k].minLength
    expected.push({ id: "G11", what: `${o.m.toUpperCase()} ${o.p} request body property ${k} string -> integer`, class: "breaking", tokens: [op(o.m, o.p)] })
  }
  // G12-G15 a response-only component schema with a uniquely named string property
  {
    const { name, prop, usages } = responseOnlyComponent(before)
    const sites = componentSites(before, name)
    const s = after.components.schemas[name]
    s.properties[prop] = { ...s.properties[prop], type: "integer" }
    delete s.properties[prop].format
    delete s.properties[prop].pattern
    expected.push({ id: "G12", what: `response-only component ${name} (${usages} usages) property ${prop} string -> integer`, class: "breaking", tokens: [prop.toLowerCase()], sites })
    s.properties.bench_optional_out = { type: "string" }
    expected.push({ id: "G13", what: `response-only component ${name} gains optional property`, class: "non-breaking", tokens: ["bench_optional_out"], sites })
    const second = Object.keys(s.properties).find((k) => k !== prop && k.length > 3 && uniquePropertyName(before, k) && (s.required || []).includes(k))
    if (!second) throw new Error("github change set: no second property for G14")
    delete s.properties[second]
    s.required = s.required.filter((k) => k !== second)
    expected.push({ id: "G14", what: `response-only component ${name} required property ${second} removed`, class: "breaking", tokens: [second.toLowerCase()], sites })
    s.properties.bench_required_out = { type: "string" }
    s.required = [...(s.required || []), "bench_required_out"]
    expected.push({ id: "G15", what: `response-only component ${name} gains required property`, class: "non-breaking", tokens: ["bench_required_out"], sites })
  }
  // G16 new response code
  {
    const o = take((x) => x.responses && !x.responses["418"] && x.responses["200"], "G16")
    A(o).responses["418"] = { description: "Bench teapot" }
    expected.push({ id: "G16", what: `${o.m.toUpperCase()} ${o.p} 418 response added`, class: "non-breaking", tokens: [op(o.m, o.p)] })
  }
  // G17 summary changed
  {
    const o = take((x) => typeof x.summary === "string", "G17")
    A(o).summary = `${A(o).summary} (bench)`
    expected.push({ id: "G17", what: `${o.m.toUpperCase()} ${o.p} summary changed`, class: "annotation", tokens: [op(o.m, o.p)] })
  }
  // G18 operation deprecated
  {
    const o = take((x) => !x.deprecated, "G18")
    A(o).deprecated = true
    expected.push({ id: "G18", what: `${o.m.toUpperCase()} ${o.p} deprecated`, class: "deprecated", accept: ["non-breaking", "annotation"], tokens: [op(o.m, o.p)] })
  }
  // G19 / G20 request enum value removed / added
  {
    const o = take((x) => inlineQuery(x, (q) => Array.isArray(q.schema?.enum) && q.schema.enum.length >= 3), "G19")
    const q = A(o).parameters.find((x) => !x.$ref && x.in === "query" && Array.isArray(x.schema?.enum) && x.schema.enum.length >= 3)
    const removed = q.schema.enum[q.schema.enum.length - 1]
    q.schema.enum = q.schema.enum.slice(0, -1)
    if (q.schema.default === removed) delete q.schema.default
    expected.push({ id: "G19", what: `${o.m.toUpperCase()} ${o.p} query parameter ${q.name} enum value ${removed} removed`, class: "breaking", tokens: [op(o.m, o.p)] })
    const o2 = take((x) => inlineQuery(x, (qq) => Array.isArray(qq.schema?.enum) && qq.schema.enum.length >= 2), "G20")
    const q2 = A(o2).parameters.find((x) => !x.$ref && x.in === "query" && Array.isArray(x.schema?.enum) && x.schema.enum.length >= 2)
    q2.schema.enum = [...q2.schema.enum, "bench_value"]
    expected.push({ id: "G20", what: `${o2.m.toUpperCase()} ${o2.p} query parameter ${q2.name} enum value added`, class: "non-breaking", tokens: [op(o2.m, o2.p)] })
  }
  // G21 response header added to an inline 200 response
  {
    const o = take((x) => x.responses?.["200"] && !x.responses["200"].$ref && x.responses["200"].content, "G21")
    const r = A(o).responses["200"]
    r.headers = { ...(r.headers || {}), "X-Bench-Header": { schema: { type: "string" } } }
    expected.push({ id: "G21", what: `${o.m.toUpperCase()} ${o.p} 200 response header added`, class: "non-breaking", tokens: [op(o.m, o.p)] })
  }
  // an operation-level change is attributed by its operation token alone, so its operation must not also be a usage
  // site of a changed component (otherwise the component's diffs would be credited to it)
  const siteOps = new Set(expected.flatMap((e) => (e.sites || []).map((x) => x[0])))
  for (const e of expected) if (!e.sites && e.tokens.length === 1 && siteOps.has(e.tokens[0])) throw new Error(`github change set: ${e.id} overlaps a component usage site`)
  return { before, after, expected }
}

// collects every $ref usage with its context (request / response / schema:<name> / other)
const refUsages = (doc) => {
  const uses = new Map()
  const walk = (node, ctx) => {
    if (!node || typeof node !== "object") return
    if (Array.isArray(node)) return node.forEach((n) => walk(n, ctx))
    if (typeof node.$ref === "string") {
      const list = uses.get(node.$ref) || []
      list.push(ctx)
      uses.set(node.$ref, list)
    }
    for (const k of Object.keys(node)) {
      let c = ctx
      if (k === "requestBody" || k === "parameters") c = "request"
      else if (k === "responses" || k === "headers") c = ctx === "request" ? ctx : "response"
      walk(node[k], c)
    }
  }
  for (const p of Object.keys(doc.paths)) walk(doc.paths[p], "other")
  for (const [k, v] of Object.entries(doc.components.responses || {})) walk(v, "response")
  for (const [k, v] of Object.entries(doc.components.schemas || {})) walk(v, `schema:${k}`)
  return uses
}

// operations whose responses reference a component directly (through components.responses as well)
const componentSites = (doc, name) => {
  const ref = `#/components/schemas/${name}`
  const viaResponses = Object.keys(doc.components.responses || {}).filter((k) => JSON.stringify(doc.components.responses[k]).includes(`"${ref}"`))
  const sites = []
  for (const p of Object.keys(doc.paths)) {
    for (const m of METHODS) {
      const o = doc.paths[p][m]
      if (!o) continue
      const r = JSON.stringify(o.responses || {})
      if (r.includes(`"${ref}"`) || viaResponses.some((k) => r.includes(`"#/components/responses/${k}"`))) sites.push(site(m, p, "responses"))
    }
  }
  return sites
}

const propertyNameCounts = (doc) => {
  const counts = new Map()
  const walk = (node) => {
    if (!node || typeof node !== "object") return
    if (Array.isArray(node)) return node.forEach(walk)
    if (node.properties && typeof node.properties === "object" && !Array.isArray(node.properties)) {
      for (const k of Object.keys(node.properties)) counts.set(k, (counts.get(k) || 0) + 1)
    }
    for (const k of Object.keys(node)) walk(node[k])
  }
  walk(doc)
  return counts
}
let _counts
const uniquePropertyName = (doc, name) => {
  _counts = _counts || propertyNameCounts(doc)
  return _counts.get(name) === 1
}

const responseOnlyComponent = (doc) => {
  const uses = refUsages(doc)
  const names = Object.keys(doc.components.schemas).sort()
  for (const name of names) {
    const u = uses.get(`#/components/schemas/${name}`) || []
    if (u.length < 2 || u.length > 10 || !u.every((c) => c === "response")) continue
    const s = doc.components.schemas[name]
    if (!s.properties) continue
    const prop = Object.keys(s.properties).find((k) => s.properties[k].type === "string" && !s.properties[k].enum && k.length > 5 && uniquePropertyName(doc, k))
    if (prop && Object.keys(s.properties).filter((k) => k !== prop && k.length > 3 && uniquePropertyName(doc, k) && (s.required || []).includes(k)).length >= 1) return { name, prop, usages: u.length }
  }
  throw new Error("github change set: no response-only component")
}

// ---- synthetic documents (test/performance.test.ts shapes at larger sizes) ----
const wideSchema = (n, changed) => ({
  type: "object",
  properties: Object.fromEntries(Array.from({ length: n }, (_, i) => [`p${i}`, { type: changed && i % 20 === 0 ? "integer" : "string" }])),
})
const deepSchema = (depth, leafType) => {
  let s = { type: leafType }
  for (let i = 0; i < depth; i++) s = { type: "object", properties: { [`c${depth - i}`]: s } }
  return s
}
const oasWith = (schema, response) => ({
  openapi: "3.0.3",
  info: { title: "bench", version: "1.0.0" },
  paths: {
    "/p": {
      post: response
        ? { responses: { 200: { description: "ok", content: { "application/json": { schema } } } } }
        : { requestBody: { content: { "application/json": { schema } } }, responses: { 204: { description: "ok" } } },
    },
  },
})
const refsDoc = (n, type) => ({
  openapi: "3.0.3",
  info: { title: "bench", version: "1.0.0" },
  paths: Object.fromEntries(
    Array.from({ length: n }, (_, i) => [
      `/p${i}`,
      { get: { responses: { 200: { description: "ok", content: { "application/json": { schema: { $ref: "#/components/schemas/E" } } } } } } },
    ]),
  ),
  components: { schemas: { E: { type: "object", properties: { code: { type }, message: { type: "string" } } } } },
})
const oneOfSchema = (n, type) => ({
  oneOf: Array.from({ length: n }, (_, i) => ({
    type: "object",
    properties: Object.fromEntries(Array.from({ length: n }, (_, j) => [`k${i}_${j}`, { type: i === 0 && j === 0 ? type : "string" }])),
  })),
})

const fixtures = [
  {
    name: "oas-petstore",
    family: "openapi",
    spec: "oas30",
    kind: "changeset",
    desc: "petstore.yaml (repo) + base patch, 24 scripted changes",
    generate: () => {
      const before = petstoreBase()
      return { before, after: petstoreAfter(before), expected: petstoreExpected() }
    },
  },
  {
    name: "oas-petstore-identical",
    family: "openapi",
    spec: "oas30",
    kind: "identical",
    desc: "petstore.yaml (repo) compared with itself",
    generate: () => ({ before: loadPetstore(), after: loadPetstore() }),
  },
  {
    name: "oas31-petstore",
    family: "openapi",
    spec: "oas31",
    kind: "changeset",
    desc: "oas-petstore with openapi: 3.1.0 on both sides",
    generate: () => {
      const before = withVersion(petstoreBase(), "3.1.0")
      return { before, after: withVersion(petstoreAfter(before), "3.1.0"), expected: petstoreExpected() }
    },
  },
  {
    name: "oas32-petstore",
    family: "openapi",
    spec: "oas32",
    kind: "changeset",
    desc: "oas-petstore with openapi: 3.2.0 on both sides",
    generate: () => {
      const before = withVersion(petstoreBase(), "3.2.0")
      return { before, after: withVersion(petstoreAfter(before), "3.2.0"), expected: petstoreExpected() }
    },
  },
  {
    name: "oas-override-identical",
    family: "openapi",
    spec: "oas30",
    kind: "identical",
    desc: "operation-level parameter overriding a path-level one, 4XX/5XX codes, header params; compared with itself",
    generate: () => {
      const d = () => ({
        openapi: "3.0.3",
        info: { title: "override", version: "1.0.0" },
        paths: {
          "/items/{id}": {
            parameters: [
              { name: "id", in: "path", required: true, schema: { type: "string" } },
              { name: "limit", in: "query", schema: { type: "integer" } },
            ],
            get: {
              parameters: [{ name: "limit", in: "query", required: true, schema: { type: "integer", maximum: 50 } }],
              responses: {
                200: { description: "ok", content: { "application/json": { schema: { type: "object", properties: { id: { type: "string" } } } } } },
                "4XX": { description: "client error", content: { "application/json": { schema: { type: "object", properties: { code: { type: "integer" } } } } } },
                "5XX": { description: "server error" },
              },
            },
          },
        },
      })
      return { before: d(), after: d() }
    },
  },
  ...[1000, 4000, 10000].map((n) => ({
    name: `oas-wide-${n}`,
    family: "openapi",
    spec: "oas30",
    kind: "synthetic",
    group: "scale-wide",
    size: n,
    desc: `request body schema with ${n} properties, every 20th type string -> integer (${n / 20} changes)`,
    generate: () => ({
      before: oasWith(wideSchema(n, false), false),
      after: oasWith(wideSchema(n, true), false),
      expected: Array.from({ length: n / 20 }, (_, k) => ({ id: `W${k * 20}`, what: `p${k * 20} type`, class: "breaking", tokens: [propTok(`p${k * 20}`), "type"], sites: [[op("post", "/p"), "requestbody"]] })),
    }),
  })),
  ...[100, 500].map((n) => ({
    name: `oas-deep-${n}`,
    family: "openapi",
    spec: "oas30",
    kind: "synthetic",
    group: "scale-deep",
    size: n,
    desc: `request body schema nested ${n} levels, leaf type string -> integer`,
    generate: () => ({ before: oasWith(deepSchema(n, "string"), false), after: oasWith(deepSchema(n, "integer"), false), expected: [{ id: "D1", what: "leaf type", class: "breaking", tokens: ["type"], sites: [[op("post", "/p"), "requestbody"]] }] }),
  })),
  ...[500, 2000].map((n) => ({
    name: `oas-refs-${n}`,
    family: "openapi",
    spec: "oas30",
    kind: "synthetic",
    group: "scale-refs",
    size: n,
    desc: `${n} operations whose 200 response uses one $ref component; its property code string -> integer`,
    generate: () => ({ before: refsDoc(n, "string"), after: refsDoc(n, "integer"), expected: [{ id: "R1", what: "E.code type in response", class: "breaking", tokens: ["code"], sites: [["responses"]] }] }),
  })),
  ...["request", "response"].map((dir) => ({
    name: `oas-dir-${dir}-1500`,
    family: "openapi",
    spec: "oas30",
    kind: "synthetic",
    group: "direction",
    desc: `1 500-property schema used only in a ${dir}, first property type string -> integer`,
    generate: () => {
      const s = (t) => ({ type: "object", properties: Object.fromEntries(Array.from({ length: 1500 }, (_, i) => [`p${i}`, { type: i === 0 ? t : "string" }])) })
      return { before: oasWith(s("string"), dir === "response"), after: oasWith(s("integer"), dir === "response"), expected: [{ id: "T1", what: "p0 type", class: "breaking", tokens: [propTok("p0"), "type"], sites: [[op("post", "/p")]] }] }
    },
  })),
  {
    name: "oas-oneof-40",
    family: "openapi",
    spec: "oas30",
    kind: "synthetic",
    group: "combinators",
    desc: "request body oneOf with 40 branches of 40 properties, one leaf type change",
    generate: () => ({ before: oasWith(oneOfSchema(40, "string"), false), after: oasWith(oneOfSchema(40, "integer"), false), expected: [{ id: "O1", what: "k0_0 type", class: "breaking", tokens: ["k0_0"], sites: [[op("post", "/p"), "requestbody"]] }] }),
  },
  {
    name: "oas-github",
    family: "openapi",
    spec: "oas30",
    kind: "changeset",
    group: "large",
    desc: "GitHub REST API description (7.6 MB minified, 1 281 operations, 1 015 schemas), 21 scripted changes",
    generate: githubChangeSet,
  },
  {
    name: "oas-github-identical",
    family: "openapi",
    spec: "oas30",
    kind: "identical",
    group: "large",
    desc: "GitHub REST API description compared with itself",
    generate: () => ({ before: loadGithub(), after: loadGithub() }),
  },
]

module.exports = { fixtures }
