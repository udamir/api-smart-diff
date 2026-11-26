import { annotation, breaking, nonBreaking } from "../../../src"
import { type CompatCase, runCases } from "../../helpers/compat"

// Callbacks (operation callbacks, callback expressions, callback operations and their payload direction,
// components.callbacks), 3.1 webhooks and response links (components.links).

const info = { title: "compat", version: "1.0.0" }
const ok = { 200: { description: "ok" } }
const op = (o: Record<string, unknown> = {}) => ({ ...o, responses: ok })
const obj = (properties: Record<string, unknown>, required?: string[]) => ({
  type: "object",
  properties,
  ...(required ? { required } : {}),
})
const json = (schema: unknown) => ({ content: { "application/json": { schema } } })
const str = { type: "string" }

/** An event delivery operation: the API POSTs `body` and expects `reply` back. */
const delivery = (body: unknown = obj({ id: str }), reply: unknown = obj({ ack: str })) => ({
  requestBody: json(body),
  responses: { 200: { description: "ok", ...json(reply) } },
})
const subscribe = (callbacks?: Record<string, unknown>) => ({
  openapi: "3.1.0",
  info,
  paths: { "/subscribe": { post: op(callbacks ? { callbacks } : {}) } },
})
const EXPR = "{$request.body#/callbackUrl}"
const onEvent = (pathItem: Record<string, unknown> = { post: delivery() }) => ({ onEvent: { [EXPR]: pathItem } })
const CB = "paths/~1subscribe/post/callbacks"
const CBOP = `${CB}/onEvent/${EXPR.replace(/\//g, "~1")}/post`

const hooks = (webhooks?: Record<string, unknown>) => ({
  openapi: "3.1.0",
  info,
  paths: {},
  ...(webhooks ? { webhooks } : {}),
})

const linked = (links?: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  openapi: "3.1.0",
  info,
  paths: {
    "/pets": { post: { responses: { 201: { description: "created", ...(links ? { links } : {}) } } } },
    "/pets/{id}": {
      get: op({ operationId: "getPet", parameters: [{ name: "id", in: "path", required: true, schema: str }] }),
    },
  },
  ...extra,
})
const LINKS = "paths/~1pets/post/responses/201/links"
const getPetLink = (o: Record<string, unknown> = {}) => ({
  operationId: "getPet",
  parameters: { id: "$response.body#/id" },
  ...o,
})

// POLICY-12 decided (a): callback semantics; the API sends the webhook request, so its payload takes response semantics
// and the receiver's reply request semantics (as ASD does for callbacks, §4.6); ISSUE-135 (fixed)

const cases: CompatCase[] = [
  // ---------------------------------------------------------------------------------------------------------------
  // callbacks
  {
    kind: "doc",
    id: "OAS-CB-001",
    title: "callback added to an operation",
    before: "POST /subscribe without callbacks",
    after: "POST /subscribe callbacks.onEvent",
    rationale: "existing subscribers are unaffected until they handle the new event (libopenapi non-breaking)",
    annotation: "names the operation and the callback",
    sources: [
      { tool: "libopenapi", ref: "operation_test.go TestCompareOperations_V3_AddCallback", verdict: "non-breaking" },
      { tool: "oasdiff", ref: "coverage waiver #1161 (callbacks)", verdict: "no rule" },
    ],
    docs: [subscribe(), subscribe(onEvent())],
    expect: [{ at: [CB, `${CB}/**`], action: "add", type: nonBreaking, mentions: ["POST /subscribe", "onEvent"] }],
    // ISSUE-81 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-CB-002",
    title: "all callbacks of an operation removed",
    before: "POST /subscribe callbacks.onEvent",
    after: "POST /subscribe without callbacks",
    rationale: "subscribers that rely on receiving the event no longer get it (libopenapi breaking)",
    annotation: "names the operation and the callback",
    sources: [
      { tool: "libopenapi", ref: "operation_test.go TestCompareOperations_V3_RemoveCallbacks", verdict: "breaking" },
      { tool: "oasdiff", ref: "diff/diff_test.go TestSchemaDiff_DeletedCallback" },
    ],
    docs: [subscribe(onEvent()), subscribe()],
    expect: [{ at: [CB, `${CB}/**`], action: "remove", type: breaking, mentions: ["POST /subscribe", "onEvent"] }],
    // ISSUE-81 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-CB-003",
    title: "one of two callbacks added and removed",
    before: "callbacks { onEvent } / { onEvent, onError }",
    after: "{ onEvent, onError } / { onEvent }",
    rationale: "a new callback is an extra event; a removed one is an event subscribers no longer receive",
    annotation: "names the operation and the callback",
    sources: [
      { tool: "libopenapi", ref: "operation_test.go TestCompareOperations_V3_AddCallback / _RemoveCallback" },
      { tool: "asd", ref: "test/openapi/paths-operations.test.ts C2.12" },
    ],
    docs: {
      added: [subscribe(onEvent()), subscribe({ ...onEvent(), onError: { [EXPR]: { post: delivery() } } })],
      removed: [subscribe({ ...onEvent(), onError: { [EXPR]: { post: delivery() } } }), subscribe(onEvent())],
    },
    expect: {
      added: [{ at: `${CB}/onError`, action: "add", type: nonBreaking, mentions: ["POST /subscribe", "onError"] }],
      removed: [{ at: `${CB}/onError`, action: "remove", type: breaking, mentions: ["POST /subscribe", "onError"] }],
    },
    // ISSUE-81 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-CB-004",
    title: "callback URL expression changed",
    before: "onEvent: {$request.body#/callbackUrl}",
    after: "onEvent: {$request.body#/hookUrl}",
    rationale:
      "the API now reads the callback URL from another request field, so subscribers sending callbackUrl get no events",
    annotation: "names the callback and both expressions",
    sources: [
      {
        tool: "libopenapi",
        ref: "callback_test.go TestCompareCallback_Add / _Remove (expressions)",
        verdict: "removed breaking, added non-breaking",
      },
      { tool: "oasdiff", ref: "diff/diff_test.go TestSchemaDiff_ModifiedCallback (expression deleted)" },
    ],
    docs: [subscribe(onEvent()), subscribe({ onEvent: { "{$request.body#/hookUrl}": { post: delivery() } } })],
    expect: [
      {
        at: `${CB}/onEvent/${EXPR.replace(/\//g, "~1")}`,
        action: "remove",
        type: breaking,
        mentions: ["onEvent", EXPR],
      },
      {
        at: `${CB}/onEvent/{$request.body#~1hookUrl}`,
        action: "add",
        type: nonBreaking,
        mentions: ["onEvent", "{$request.body#/hookUrl}"],
      },
    ],
    // ISSUE-68 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-CB-005",
    title: "callback operation removed",
    before: "onEvent path item POST and PUT",
    after: "onEvent path item POST",
    rationale: "subscribers implementing the PUT callback no longer receive it",
    annotation: "names the callback operation (PUT) and the callback",
    sources: [{ tool: "libopenapi", ref: "callback_test.go TestCompareCallback_Modify (path item rules)" }],
    docs: [subscribe(onEvent({ post: delivery(), put: delivery() })), subscribe(onEvent())],
    expect: [{ at: `${CB}/onEvent/*/put`, action: "remove", type: breaking, mentions: ["PUT", "onEvent"] }],
    // ISSUE-81 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-CB-006",
    title: "callback request payload gains a required property",
    before: "callback POST body { id }",
    after: "body { id, kind } required [kind]",
    rationale:
      "the API sends the callback request: subscribers receive an extra field, which is non-breaking for them (response semantics, §4.6)",
    annotation: "names the property and the request body",
    sources: [
      { tool: "asd", ref: "openapi3.rules.ts callbackRules (inverted direction)" },
      { tool: "oasdiff", ref: "diff/diff_test.go TestSchemaDiff_AddedRequestBody (callback)" },
    ],
    docs: [subscribe(onEvent()), subscribe(onEvent({ post: delivery(obj({ id: str, kind: str }, ["kind"])) }))],
    expect: [
      {
        at: [
          `${CBOP}/requestBody/content/application~1json/schema/properties/kind`,
          `${CBOP}/requestBody/content/application~1json/schema/required/**`,
        ],
        action: "add",
        type: nonBreaking,
        mentions: ["kind"],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-CB-007",
    title: "callback response (the subscriber's reply) gains a required property",
    before: "callback 200 reply { ack }",
    after: "reply { ack, receipt } required [receipt]",
    rationale:
      "subscribers write the reply: existing subscribers do not send receipt, so the API's expectation breaks them (request semantics)",
    annotation: "names the property and the response",
    sources: [{ tool: "asd", ref: "openapi3.rules.ts callbackRules (inverted direction)" }],
    docs: [
      subscribe(onEvent()),
      subscribe(onEvent({ post: delivery(undefined, obj({ ack: str, receipt: str }, ["receipt"])) })),
    ],
    expect: [
      {
        at: [
          `${CBOP}/responses/200/content/application~1json/schema/properties/receipt`,
          `${CBOP}/responses/200/content/application~1json/schema/required/**`,
        ],
        action: "add",
        type: breaking,
        mentions: ["receipt"],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-CB-008",
    title: "callback request payload property type changed",
    before: "callback body { id: string }",
    after: "body { id: integer }",
    rationale: "subscribers parsing id as a string break (breaking in either direction)",
    annotation: "names the property and the type change",
    sources: [{ tool: "libopenapi", ref: "callback_test.go TestCompareCallback_Modify" }],
    docs: [subscribe(onEvent()), subscribe(onEvent({ post: delivery(obj({ id: { type: "integer" } })) }))],
    expect: [
      {
        at: `${CBOP}/requestBody/content/application~1json/schema/properties/id/type`,
        type: breaking,
        mentions: ["id"],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-CB-009",
    title: "callback operation summary changed",
    before: "callback POST summary Event",
    after: "summary Pet event",
    rationale: "documentation only",
    annotation: "names the callback operation and the summary",
    sources: [{ tool: "asd", ref: "test/openapi/paths-operations.test.ts C2.12" }],
    docs: [
      subscribe(onEvent({ post: { ...delivery(), summary: "Event" } })),
      subscribe(onEvent({ post: { ...delivery(), summary: "Pet event" } })),
    ],
    expect: [{ at: `${CBOP}/summary`, type: annotation, mentions: ["onEvent", "summary"] }],
    // ISSUE-81 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-CB-010",
    title: "referenced components.callbacks entry changed",
    before: "callbacks { onEvent: $ref Event }, Event POST body { id: string }",
    after: "Event POST body { id: integer }",
    rationale:
      "every operation that references the callback sends the new payload; reported at the usage site and the component",
    annotation: "names the property at both sites",
    sources: [
      { tool: "libopenapi", ref: "components_test.go _Callbacks_Modified (diffed at usage)" },
      { tool: "oasdiff", ref: "components resolved at usage" },
    ],
    docs: [
      {
        ...subscribe({ onEvent: { $ref: "#/components/callbacks/Event" } }),
        components: { callbacks: { Event: { [EXPR]: { post: delivery() } } } },
      },
      {
        ...subscribe({ onEvent: { $ref: "#/components/callbacks/Event" } }),
        components: { callbacks: { Event: { [EXPR]: { post: delivery(obj({ id: { type: "integer" } })) } } } },
      },
    ],
    expect: [
      {
        at: [
          `${CBOP}/requestBody/content/application~1json/schema/properties/id/type`,
          "components/callbacks/Event/*/post/requestBody/content/application~1json/schema/properties/id/type",
        ],
        type: breaking,
        mentions: ["id"],
      },
    ],
  },
  // ---------------------------------------------------------------------------------------------------------------
  // webhooks (3.1)
  {
    kind: "doc",
    id: "OAS-WH-001",
    title: "webhook added",
    before: "webhooks { newPet }",
    after: "webhooks { newPet, petSold }",
    rationale: "a new event cannot break existing receivers (oasdiff webhook-added INFO)",
    annotation: "names the added webhook (and its operation)",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_webhook_updated_test.go TestWebhookAddedAndRemoved webhook-added",
        verdict: "INFO",
      },
      { tool: "libopenapi", ref: "document.go webhooks (added non-breaking)" },
    ],
    covers: ["oasdiff:webhook-added"],
    docs: [
      hooks({ newPet: { post: delivery() } }),
      hooks({ newPet: { post: delivery() }, petSold: { post: delivery() } }),
    ],
    expect: [
      { at: ["webhooks/petSold", "webhooks/petSold/post"], action: "add", type: nonBreaking, mentions: ["petSold"] },
    ],
    // ISSUE-68 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-WH-002",
    title: "webhook removed",
    before: "webhooks { newPet, petSold }",
    after: "webhooks { newPet }",
    rationale: "receivers of petSold no longer get the event (oasdiff webhook-removed ERR, libopenapi breaking)",
    annotation: "names the removed webhook",
    sources: [
      { tool: "oasdiff", ref: "checker/check_webhook_updated_test.go TestWebhookAddedAndRemoved webhook-removed" },
      { tool: "libopenapi", ref: "document.go webhooks (removed breaking)" },
    ],
    covers: ["oasdiff:webhook-removed"],
    docs: [
      hooks({ newPet: { post: delivery() }, petSold: { post: delivery() } }),
      hooks({ newPet: { post: delivery() } }),
    ],
    expect: [
      { at: ["webhooks/petSold", "webhooks/petSold/post"], action: "remove", type: breaking, mentions: ["petSold"] },
    ],
    // ISSUE-68 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-WH-003",
    title: "webhook renamed",
    before: "webhooks { orderDeleted }",
    after: "webhooks { orderUpdated }",
    rationale: "webhooks are identified by name: one event is gone, another is new",
    annotation: "names both webhooks",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_webhook_updated_test.go TestWebhookAddedAndRemoved (rename = remove + add)",
      },
    ],
    covers: ["oasdiff:webhook-removed", "oasdiff:webhook-added"],
    docs: [hooks({ orderDeleted: { post: delivery() } }), hooks({ orderUpdated: { post: delivery() } })],
    expect: [
      {
        at: ["webhooks/orderDeleted", "webhooks/orderDeleted/post"],
        action: "remove",
        type: breaking,
        mentions: ["orderDeleted"],
      },
      {
        at: ["webhooks/orderUpdated", "webhooks/orderUpdated/post"],
        action: "add",
        type: nonBreaking,
        mentions: ["orderUpdated"],
      },
    ],
    // ISSUE-68 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-WH-004",
    title: "webhooks section added and removed as a whole",
    before: "no webhooks / webhooks { newPet }",
    after: "webhooks { newPet } / none",
    rationale: "adding events is non-breaking, removing all events breaks their receivers",
    annotation: "names the webhook",
    sources: [
      { tool: "oasdiff", ref: "diff/webhooks_diff_test.go TestWebhooks_OnlyInRevision / _OnlyInBase" },
      { tool: "libopenapi", ref: "document.go webhooks" },
    ],
    covers: ["oasdiff:webhook-added", "oasdiff:webhook-removed"],
    docs: {
      added: [hooks(), hooks({ newPet: { post: delivery() } })],
      removed: [hooks({ newPet: { post: delivery() } }), hooks()],
    },
    expect: {
      added: [{ at: ["webhooks", "webhooks/**"], action: "add", type: nonBreaking, mentions: ["newPet"] }],
      removed: [{ at: ["webhooks", "webhooks/**"], action: "remove", type: breaking, mentions: ["newPet"] }],
    },
    // ISSUE-68 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-WH-005",
    title: "webhook operation added and removed",
    before: "webhooks.newPet POST / POST + PUT",
    after: "POST + PUT / POST",
    rationale: "a new delivery method is an addition; a removed one is no longer sent",
    annotation: "names the webhook and the method",
    sources: [{ tool: "oasdiff", ref: "diff/webhooks_diff_test.go TestWebhooks_Modified" }],
    docs: {
      added: [hooks({ newPet: { post: delivery() } }), hooks({ newPet: { post: delivery(), put: delivery() } })],
      removed: [hooks({ newPet: { post: delivery(), put: delivery() } }), hooks({ newPet: { post: delivery() } })],
    },
    expect: {
      added: [{ at: "webhooks/newPet/put", action: "add", type: nonBreaking, mentions: ["PUT", "newPet"] }],
      removed: [{ at: "webhooks/newPet/put", action: "remove", type: breaking, mentions: ["PUT", "newPet"] }],
    },
  },
  {
    kind: "doc",
    id: "OAS-WH-006",
    title: "webhook payload gains a required property",
    before: "webhooks.newPet POST body { id }",
    after: "body { id, name } required [name]",
    rationale:
      "the API sends the webhook: receivers get an extra field, which cannot break them (proposed option a: callback semantics); oasdiff and ASD 2.0.0 treat it as a request change",
    annotation: "names the property and the request body",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_webhook_operation_test.go TestWebhookOperationChangesDetected",
        verdict: "new-optional-request-property / request rules",
      },
    ],
    docs: [
      hooks({ newPet: { post: delivery() } }),
      hooks({ newPet: { post: delivery(obj({ id: str, name: str }, ["name"])) } }),
    ],
    expect: [
      {
        at: [
          "webhooks/newPet/post/requestBody/content/application~1json/schema/properties/name",
          "webhooks/newPet/post/requestBody/content/application~1json/schema/required/**",
        ],
        action: "add",
        type: nonBreaking,
        mentions: ["name"],
      },
    ],
    // ISSUE-135 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-WH-007",
    title: "webhook request body became required",
    before: "webhooks.newPet POST requestBody required false",
    after: "required true",
    rationale:
      "under callback semantics the API now always sends a body, which receivers already accept (proposed option a); oasdiff reports request-body-became-required",
    annotation: "names the request body and the required status",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_webhook_operation_test.go TestWebhookOperationChangesDetected (request-body-became-required)",
      },
    ],
    docs: [
      hooks({ newPet: { post: { ...delivery(), requestBody: { required: false, ...json(obj({ id: str })) } } } }),
      hooks({ newPet: { post: { ...delivery(), requestBody: { required: true, ...json(obj({ id: str })) } } } }),
    ],
    expect: [{ at: "webhooks/newPet/post/requestBody/required", type: nonBreaking, mentions: ["required"] }],
    // ISSUE-135 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-WH-008",
    title: "webhook path item description and operation summary changed",
    before: "webhooks.newPet description a, POST summary a",
    after: "description b, summary b",
    rationale: "documentation only",
    annotation: "names the webhook and the field",
    sources: [
      {
        tool: "libopenapi",
        ref: "document_test.go TestCompareDocuments_OpenAPI_ModifyWebhooks",
        verdict: "non-breaking",
      },
    ],
    docs: {
      description: [
        hooks({ newPet: { description: "a", post: delivery() } }),
        hooks({ newPet: { description: "b", post: delivery() } }),
      ],
      summary: [
        hooks({ newPet: { post: { ...delivery(), summary: "a" } } }),
        hooks({ newPet: { post: { ...delivery(), summary: "b" } } }),
      ],
    },
    expect: {
      description: [{ at: "webhooks/newPet/description", type: annotation, mentions: ["newPet", "description"] }],
      summary: [{ at: "webhooks/newPet/post/summary", type: annotation, mentions: ["newPet", "summary"] }],
    },
    // ISSUE-81 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-WH-009",
    title: "webhook referencing components.pathItems: operation removed from the path item",
    before: "webhooks.newPet $ref PetEvent (POST, PUT)",
    after: "PetEvent (POST)",
    rationale: "the PUT delivery is no longer sent to receivers",
    annotation: "names the webhook (or component) and PUT",
    sources: [{ tool: "asd", ref: "test/openapi/openapi32.test.ts G15 (webhooks and components.pathItems)" }],
    docs: [
      {
        ...hooks({ newPet: { $ref: "#/components/pathItems/PetEvent" } }),
        components: { pathItems: { PetEvent: { post: delivery(), put: delivery() } } },
      },
      {
        ...hooks({ newPet: { $ref: "#/components/pathItems/PetEvent" } }),
        components: { pathItems: { PetEvent: { post: delivery() } } },
      },
    ],
    expect: [
      { at: "webhooks/newPet/put", action: "remove", type: breaking, mentions: ["PUT", "newPet"] },
      { at: "components/pathItems/PetEvent/put", action: "remove", type: breaking, mentions: ["PUT", "PetEvent"] },
    ],
    // ISSUE-81 (fixed) (P8-OAS)
  },
  // ---------------------------------------------------------------------------------------------------------------
  // links
  {
    kind: "doc",
    id: "OAS-LINK-001",
    title: "first link added to a response",
    before: "POST /pets 201 without links",
    after: "201 links { GetPet }",
    rationale: "a new link is additional hypermedia guidance; existing clients are unaffected",
    annotation: "names the link and the response",
    sources: [
      {
        tool: "libopenapi",
        ref: "components_test.go TestCompareComponents_OpenAPI_Links_Added",
        verdict: "non-breaking",
      },
      { tool: "oasdiff", ref: "non-contract (links)", verdict: "no rule" },
    ],
    docs: [linked(), linked({ GetPet: getPetLink() })],
    expect: [{ at: [LINKS, `${LINKS}/**`], action: "add", type: nonBreaking, mentions: ["GetPet", "201"] }],
    // ISSUE-84 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-LINK-002",
    title: "link added to and removed from a response",
    before: "links { Self } / { Self, GetPet }",
    after: "{ Self, GetPet } / { Self }",
    rationale: "clients following the removed link can no longer navigate to the target",
    annotation: "names the link and the response",
    sources: [
      { tool: "libopenapi", ref: "link.go (CheckMapForChanges: removed breaking)", verdict: "removed breaking" },
    ],
    docs: {
      added: [linked({ Self: getPetLink() }), linked({ Self: getPetLink(), GetPet: getPetLink() })],
      removed: [linked({ Self: getPetLink(), GetPet: getPetLink() }), linked({ Self: getPetLink() })],
    },
    expect: {
      added: [{ at: `${LINKS}/GetPet`, action: "add", type: nonBreaking, mentions: ["GetPet", "201"] }],
      removed: [{ at: `${LINKS}/GetPet`, action: "remove", type: breaking, mentions: ["GetPet", "201"] }],
    },
  },
  {
    kind: "doc",
    id: "OAS-LINK-003",
    title: "all links of a response removed",
    before: "201 links { GetPet }",
    after: "201 without links",
    rationale: "clients following the link can no longer navigate",
    annotation: "names the link and the response",
    sources: [{ tool: "libopenapi", ref: "link.go (removed breaking)" }],
    docs: [linked({ GetPet: getPetLink() }), linked()],
    expect: [{ at: [LINKS, `${LINKS}/**`], action: "remove", type: breaking, mentions: ["GetPet", "201"] }],
    // ISSUE-84 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-LINK-004",
    title: "link target changed (operationId, operationRef)",
    before: "GetPet operationId getPet / operationRef #/paths/~1pets~1{id}/get",
    after: "operationId getPetV2 / operationRef #/paths/~1animals~1{id}/get",
    rationale: "clients following the link now call another operation (libopenapi breaking; oasdiff has no link rules)",
    annotation: "names the link and the new target",
    sources: [
      { tool: "libopenapi", ref: "link_test.go TestCompareLinks", verdict: "breaking" },
      { tool: "oasdiff", ref: "checker/check_not_breaking_test.go TestBreaking_LinkOperationID", verdict: "no change" },
    ],
    docs: {
      operationId: [linked({ GetPet: getPetLink() }), linked({ GetPet: getPetLink({ operationId: "getPetV2" }) })],
      operationRef: [
        linked({ GetPet: { operationRef: "#/paths/~1pets~1{id}/get" } }),
        linked({ GetPet: { operationRef: "#/paths/~1animals~1{id}/get" } }),
      ],
    },
    expect: {
      operationId: [{ at: `${LINKS}/GetPet/operationId`, type: breaking, mentions: ["GetPet", "getPetV2"] }],
      operationRef: [
        { at: `${LINKS}/GetPet/operationRef`, type: breaking, mentions: ["GetPet", "#/paths/~1animals~1{id}/get"] },
      ],
    },
    // ISSUE-84 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-LINK-005",
    title: "link parameter added, removed and changed",
    before: "GetPet parameters { id } / { id, expand } / { id: $response.body#/id }",
    after: "{ id, expand } / { id } / { id: $response.body#/petId }",
    rationale:
      "an extra parameter is more guidance; a removed or changed one no longer supplies the value clients relied on (libopenapi flags every parameter change)",
    annotation: "names the link and the parameter",
    sources: [
      {
        tool: "libopenapi",
        ref: "link_test.go TestCompareLinks_AddParam / _RemoveParam / _ModifyParam",
        verdict: "breaking (all actions)",
      },
    ],
    docs: {
      added: [
        linked({ GetPet: getPetLink() }),
        linked({ GetPet: getPetLink({ parameters: { id: "$response.body#/id", expand: "owner" } }) }),
      ],
      removed: [
        linked({ GetPet: getPetLink({ parameters: { id: "$response.body#/id", expand: "owner" } }) }),
        linked({ GetPet: getPetLink() }),
      ],
      changed: [
        linked({ GetPet: getPetLink() }),
        linked({ GetPet: getPetLink({ parameters: { id: "$response.body#/petId" } }) }),
      ],
    },
    expect: {
      added: [
        { at: `${LINKS}/GetPet/parameters/expand`, action: "add", type: nonBreaking, mentions: ["GetPet", "expand"] },
      ],
      removed: [
        { at: `${LINKS}/GetPet/parameters/expand`, action: "remove", type: breaking, mentions: ["GetPet", "expand"] },
      ],
      changed: [{ at: `${LINKS}/GetPet/parameters/id`, action: "replace", type: breaking, mentions: ["GetPet", "id"] }],
    },
  },
  {
    kind: "doc",
    id: "OAS-LINK-006",
    title: "link requestBody and description added",
    before: "GetPet without requestBody / description",
    after: "requestBody $response.body / description added",
    rationale: "a supplied body is additional guidance; the description is documentation",
    annotation: "names the link and the field",
    sources: [
      {
        tool: "libopenapi",
        ref: "link_test.go TestCompareLinks",
        verdict: "requestBody breaking, description non-breaking",
      },
    ],
    docs: {
      requestBody: [
        linked({ GetPet: getPetLink() }),
        linked({ GetPet: getPetLink({ requestBody: "$response.body" }) }),
      ],
      description: [linked({ GetPet: getPetLink() }), linked({ GetPet: getPetLink({ description: "Fetch the pet" }) })],
    },
    expect: {
      requestBody: [
        { at: `${LINKS}/GetPet/requestBody`, action: "add", type: nonBreaking, mentions: ["GetPet", "requestBody"] },
      ],
      description: [
        { at: `${LINKS}/GetPet/description`, action: "add", type: annotation, mentions: ["GetPet", "description"] },
      ],
    },
  },
  {
    kind: "doc",
    id: "OAS-LINK-007",
    title: "link server added",
    before: "GetPet without server",
    after: "GetPet server https://pets.example.com",
    rationale: "server information follows the servers policy (ASD annotation, libopenapi breaking)",
    annotation: "names the link and the server URL",
    sources: [{ tool: "libopenapi", ref: "link_test.go TestCompareLinks_AddServer", verdict: "breaking" }],
    docs: [
      linked({ GetPet: getPetLink() }),
      linked({ GetPet: getPetLink({ server: { url: "https://pets.example.com" } }) }),
    ],
    expect: [
      {
        at: `${LINKS}/GetPet/server`,
        action: "add",
        type: annotation,
        mentions: ["GetPet", "https://pets.example.com"],
      },
    ],
    // POLICY-09 decided (a)
    // ISSUE-84 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-LINK-008",
    title: "referenced components.links entry changed",
    before: "links { GetPet: $ref #/components/links/GetPet } (operationId getPet)",
    after: "components.links.GetPet operationId getPetV2",
    rationale: "every response using the link now points to another operation",
    annotation: "names the link and the new target at both sites",
    sources: [
      { tool: "libopenapi", ref: "components_test.go TestCompareComponents_OpenAPI_Links_Added (diffed at usage)" },
    ],
    docs: [
      linked({ GetPet: { $ref: "#/components/links/GetPet" } }, { components: { links: { GetPet: getPetLink() } } }),
      linked(
        { GetPet: { $ref: "#/components/links/GetPet" } },
        { components: { links: { GetPet: getPetLink({ operationId: "getPetV2" }) } } },
      ),
    ],
    expect: [
      {
        at: [`${LINKS}/GetPet/operationId`, "components/links/GetPet/operationId"],
        type: breaking,
        mentions: ["GetPet", "getPetV2"],
      },
    ],
    // ISSUE-84 (fixed) (P8a)
  },
]

runCases("openapi", "callbacks-webhooks-links", cases, import.meta.filename)
