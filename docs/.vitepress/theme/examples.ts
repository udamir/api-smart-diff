/**
 * Curated before / after pairs. The examples page renders each one with a live, editable comparison, the online demo
 * offers the presets, and `test/docs/examples.test.ts` runs every example through the engine and checks the listed
 * diffs, so the documentation cannot drift from the library.
 */
import { allBreaking, breaking, enumMappingResolver, nonBreaking } from "../../../src"
import type { ActionType, CompareOptions, DiffType } from "../../../src"

export type ExampleSpec = "openapi" | "asyncapi" | "jsonschema" | "graphapi"

export interface ExpectedDiff {
  type: DiffType
  action: ActionType
  /** JSON pointer of `diff.path` */
  path: string
  scope: string
}

export interface DiffExample {
  id: string
  title: string
  spec: ExampleSpec
  /** section of the examples page */
  group: string
  /** what the example shows (Markdown is not rendered, keep it plain text with `code`) */
  summary: string
  before: string
  after: string
  /** compare options that cannot be written in the editors (custom rules, external sources, ...) */
  options?: CompareOptions
  /** the TypeScript that produces `options`, shown next to the example */
  optionsCode?: string
  /** every diff the comparison returns, in any order */
  expected: ExpectedDiff[]
}

export const SPEC_LABELS: Record<ExampleSpec, string> = {
  openapi: "OpenAPI",
  asyncapi: "AsyncAPI",
  jsonschema: "JSON Schema",
  graphapi: "GraphApi",
}

const petsApi = (operation: string, components = ""): string => `openapi: 3.1.0
info:
  title: Pet store
  version: 1.0.0
paths:
  /pets:
${operation}${components}`

export const EXAMPLES: DiffExample[] = [
  // ---------------------------------------------------------------------------------------------------------------
  // OpenAPI
  {
    id: "openapi-required-parameter",
    title: "Required query parameter added",
    spec: "openapi",
    group: "Breaking and non-breaking changes",
    summary:
      "A client that does not send the new required `owner` parameter now gets an error, so the change is breaking. The optional `limit` parameter added next to it is non-breaking: existing requests stay valid.",
    before: petsApi(`    get:
      operationId: listPets
      responses:
        "200":
          description: A list of pets
`),
    after: petsApi(`    get:
      operationId: listPets
      parameters:
        - name: owner
          in: query
          required: true
          schema:
            type: string
        - name: limit
          in: query
          schema:
            type: integer
      responses:
        "200":
          description: A list of pets
`),
    expected: [
      { type: "breaking", action: "add", path: "/paths/~1pets/get/parameters/0", scope: "request" },
      { type: "non-breaking", action: "add", path: "/paths/~1pets/get/parameters/1", scope: "request" },
    ],
  },
  {
    id: "openapi-operation-removed",
    title: "Operation removed, operation added",
    spec: "openapi",
    group: "Breaking and non-breaking changes",
    summary:
      "Removing `DELETE /pets/{id}` breaks every client that calls it; adding `PUT` breaks nobody. Path templates are matched by position, so `/pets/{id}` and `/pets/{petId}` are the same path: the renamed template parameter is one non-breaking `rename` diff, and the operation diffs use the before path.",
    before: `openapi: 3.1.0
info:
  title: Pet store
  version: 1.0.0
paths:
  /pets/{id}:
    get:
      responses:
        "200":
          description: A pet
    delete:
      responses:
        "204":
          description: Deleted
`,
    after: `openapi: 3.1.0
info:
  title: Pet store
  version: 1.0.0
paths:
  /pets/{petId}:
    get:
      responses:
        "200":
          description: A pet
    put:
      responses:
        "200":
          description: Updated
`,
    expected: [
      { type: "non-breaking", action: "rename", path: "/paths", scope: "root" },
      { type: "breaking", action: "remove", path: "/paths/~1pets~1{id}/delete", scope: "root" },
      { type: "non-breaking", action: "add", path: "/paths/~1pets~1{id}/put", scope: "root" },
    ],
  },
  {
    id: "openapi-type-change",
    title: "Property type changed",
    spec: "openapi",
    group: "Breaking and non-breaking changes",
    summary:
      "Changing the type of a response property from `integer` to `string` breaks clients that parse a number. Changing a description is only an annotation.",
    before: petsApi(`    get:
      responses:
        "200":
          description: A list of pets
          content:
            application/json:
              schema:
                type: object
                properties:
                  total:
                    type: integer
                    description: Number of pets
`),
    after: petsApi(`    get:
      responses:
        "200":
          description: A list of pets
          content:
            application/json:
              schema:
                type: object
                properties:
                  total:
                    type: string
                    description: Number of pets in the store
`),
    expected: [
      {
        type: "breaking",
        action: "replace",
        path: "/paths/~1pets/get/responses/200/content/application~1json/schema/properties/total/type",
        scope: "response",
      },
      {
        type: "annotation",
        action: "replace",
        path: "/paths/~1pets/get/responses/200/content/application~1json/schema/properties/total/description",
        scope: "response",
      },
    ],
  },
  {
    id: "openapi-direction",
    title: "The same change in a request and in a response",
    spec: "openapi",
    group: "Request and response direction",
    summary:
      "A required property `name` is added to the request body and to the response. In the request the property and its required status are breaking (existing clients do not send it); in the response both are non-breaking (clients receive one more field). Each diff carries the `scope` it was classified in.",
    before: petsApi(`    post:
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                tag:
                  type: string
      responses:
        "201":
          description: Created
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: string
`),
    after: petsApi(`    post:
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [name]
              properties:
                tag:
                  type: string
                name:
                  type: string
      responses:
        "201":
          description: Created
          content:
            application/json:
              schema:
                type: object
                required: [name]
                properties:
                  id:
                    type: string
                  name:
                    type: string
`),
    expected: [
      {
        type: "breaking",
        action: "add",
        path: "/paths/~1pets/post/requestBody/content/application~1json/schema/properties/name",
        scope: "request",
      },
      {
        type: "breaking",
        action: "add",
        path: "/paths/~1pets/post/requestBody/content/application~1json/schema/required/0",
        scope: "request",
      },
      {
        type: "non-breaking",
        action: "add",
        path: "/paths/~1pets/post/responses/201/content/application~1json/schema/properties/name",
        scope: "response",
      },
      {
        type: "non-breaking",
        action: "add",
        path: "/paths/~1pets/post/responses/201/content/application~1json/schema/required/0",
        scope: "response",
      },
    ],
  },
  {
    id: "openapi-property-removed",
    title: "Property removed from a request and from a response",
    spec: "openapi",
    group: "Request and response direction",
    summary:
      "Removing a required property from a response breaks clients that read it (the property and its required status are two breaking diffs). Removing an optional property from a request is risky: clients that still send it may be rejected, others keep working. An optional response property removed would be non-breaking, since clients must already cope with its absence.",
    before: petsApi(`    post:
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
                nickname:
                  type: string
      responses:
        "201":
          description: Created
          content:
            application/json:
              schema:
                type: object
                required: [id, createdAt]
                properties:
                  id:
                    type: string
                  createdAt:
                    type: string
`),
    after: petsApi(`    post:
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
      responses:
        "201":
          description: Created
          content:
            application/json:
              schema:
                type: object
                required: [id]
                properties:
                  id:
                    type: string
`),
    expected: [
      {
        type: "risky",
        action: "remove",
        path: "/paths/~1pets/post/requestBody/content/application~1json/schema/properties/nickname",
        scope: "request",
      },
      {
        type: "breaking",
        action: "remove",
        path: "/paths/~1pets/post/responses/201/content/application~1json/schema/required/1",
        scope: "response",
      },
      {
        type: "breaking",
        action: "remove",
        path: "/paths/~1pets/post/responses/201/content/application~1json/schema/properties/createdAt",
        scope: "response",
      },
    ],
  },
  {
    id: "openapi-risky-enum",
    title: "Enum value added (risky in a response)",
    spec: "openapi",
    group: "Risky changes",
    summary:
      "A new enum value in a request is non-breaking: the server accepts more. The same value in a response is risky: it is valid, but a client with an exhaustive `switch` over the values receives one it does not know.",
    before: petsApi(`    get:
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [available, sold]
      responses:
        "200":
          description: A pet
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    enum: [available, sold]
`),
    after: petsApi(`    get:
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [available, pending, sold]
      responses:
        "200":
          description: A pet
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    enum: [available, pending, sold]
`),
    expected: [
      { type: "non-breaking", action: "add", path: "/paths/~1pets/get/parameters/0/schema/enum/1", scope: "request" },
      {
        type: "risky",
        action: "add",
        path: "/paths/~1pets/get/responses/200/content/application~1json/schema/properties/status/enum/1",
        scope: "response",
      },
    ],
  },
  {
    id: "openapi-risky-bounds",
    title: "Validation bounds tightened and loosened",
    spec: "openapi",
    group: "Risky changes",
    summary:
      "A tighter `maximum` on a request parameter is breaking: values that were accepted are now rejected. A looser `maximum` on a response property is risky: the response is still valid JSON of the same type, but a client that relied on the old bound (a fixed-size field, a progress bar) can receive a larger value.",
    before: petsApi(`    get:
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            maximum: 100
      responses:
        "200":
          description: A pet
          content:
            application/json:
              schema:
                type: object
                properties:
                  count:
                    type: integer
                    maximum: 100
`),
    after: petsApi(`    get:
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            maximum: 50
      responses:
        "200":
          description: A pet
          content:
            application/json:
              schema:
                type: object
                properties:
                  count:
                    type: integer
                    maximum: 1000
`),
    expected: [
      { type: "breaking", action: "replace", path: "/paths/~1pets/get/parameters/0/schema/maximum", scope: "request" },
      {
        type: "risky",
        action: "replace",
        path: "/paths/~1pets/get/responses/200/content/application~1json/schema/properties/count/maximum",
        scope: "response",
      },
    ],
  },
  {
    id: "openapi-deprecated",
    title: "Operation and parameter deprecated",
    spec: "openapi",
    group: "Deprecations and annotations",
    summary:
      "Setting `deprecated: true` is its own class, `deprecated`: nothing breaks yet, but clients should move away. The changed `summary` and the new `x-rate-limit` extension are annotations (documentation and metadata only).",
    before: petsApi(`    get:
      summary: List pets
      parameters:
        - name: sort
          in: query
          schema:
            type: string
      responses:
        "200":
          description: A list of pets
`),
    after: petsApi(`    get:
      summary: List all pets
      deprecated: true
      x-rate-limit: 10
      parameters:
        - name: sort
          in: query
          deprecated: true
          schema:
            type: string
      responses:
        "200":
          description: A list of pets
`),
    expected: [
      { type: "annotation", action: "replace", path: "/paths/~1pets/get/summary", scope: "root" },
      { type: "deprecated", action: "add", path: "/paths/~1pets/get/parameters/0/deprecated", scope: "request" },
      { type: "annotation", action: "add", path: "/paths/~1pets/get/x-rate-limit", scope: "root" },
      { type: "deprecated", action: "add", path: "/paths/~1pets/get/deprecated", scope: "root" },
    ],
  },
  {
    id: "openapi-component-usage",
    title: "Component classified by its usages",
    spec: "openapi",
    group: "Components and $ref",
    summary:
      "`Pet` is used only in a response, so changing the type of its `tag` property is classified with response semantics: breaking. The change is reported at the declaration in `components` and again at the usage location in the response, where `origin` points at the declaration. `Draft` is not referenced anywhere, so its change is `unclassified`.",
    before: petsApi(
      `    get:
      responses:
        "200":
          description: A pet
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Pet"
`,
      `components:
  schemas:
    Pet:
      type: object
      properties:
        id:
          type: string
        tag:
          type: string
    Draft:
      type: object
      properties:
        note:
          type: string
`,
    ),
    after: petsApi(
      `    get:
      responses:
        "200":
          description: A pet
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Pet"
`,
      `components:
  schemas:
    Pet:
      type: object
      properties:
        id:
          type: string
        tag:
          type: integer
    Draft:
      type: object
      properties:
        note:
          type: integer
`,
    ),
    expected: [
      {
        type: "breaking",
        action: "replace",
        path: "/paths/~1pets/get/responses/200/content/application~1json/schema/properties/tag/type",
        scope: "response",
      },
      { type: "breaking", action: "replace", path: "/components/schemas/Pet/properties/tag/type", scope: "components" },
      {
        type: "unclassified",
        action: "replace",
        path: "/components/schemas/Draft/properties/note/type",
        scope: "components",
      },
    ],
  },
  {
    id: "openapi-component-both-directions",
    title: "Component used in both directions",
    spec: "openapi",
    group: "Components and $ref",
    summary:
      "`Pet` is both the request body and the response. Making `name` required is breaking for the request and non-breaking for the response, and each usage reports its own class. At the declaration the component takes the most severe class of its usages: breaking.",
    before: petsApi(
      `    post:
      requestBody:
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/Pet"
      responses:
        "201":
          description: Created
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Pet"
`,
      `components:
  schemas:
    Pet:
      type: object
      properties:
        name:
          type: string
`,
    ),
    after: petsApi(
      `    post:
      requestBody:
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/Pet"
      responses:
        "201":
          description: Created
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Pet"
`,
      `components:
  schemas:
    Pet:
      type: object
      required: [name]
      properties:
        name:
          type: string
`,
    ),
    expected: [
      {
        type: "breaking",
        action: "add",
        path: "/paths/~1pets/post/requestBody/content/application~1json/schema/required/0",
        scope: "request",
      },
      {
        type: "non-breaking",
        action: "add",
        path: "/paths/~1pets/post/responses/201/content/application~1json/schema/required/0",
        scope: "response",
      },
      { type: "breaking", action: "add", path: "/components/schemas/Pet/required/0", scope: "components" },
    ],
  },
  {
    id: "openapi-component-rename",
    title: "Component renamed",
    spec: "openapi",
    group: "Renames",
    summary:
      "`Pet` is renamed to `Animal` and every `$ref` moved with it. This is one `rename` diff (an annotation) at the `schemas` map instead of a removal and an addition, and the repointed references are no change. A change made together with the rename (`name` became required) is still reported and classified on its own, and its description names both keys.",
    before: petsApi(
      `    post:
      requestBody:
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/Pet"
      responses:
        "201":
          description: Created
`,
      `components:
  schemas:
    Pet:
      type: object
      properties:
        name:
          type: string
        tag:
          type: string
`,
    ),
    after: petsApi(
      `    post:
      requestBody:
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/Animal"
      responses:
        "201":
          description: Created
`,
      `components:
  schemas:
    Animal:
      type: object
      required: [name]
      properties:
        name:
          type: string
        tag:
          type: string
`,
    ),
    expected: [
      {
        type: "breaking",
        action: "add",
        path: "/paths/~1pets/post/requestBody/content/application~1json/schema/required/0",
        scope: "request",
      },
      { type: "annotation", action: "rename", path: "/components/schemas", scope: "components" },
      { type: "breaking", action: "add", path: "/components/schemas/Pet/required/0", scope: "components" },
    ],
  },
  {
    id: "openapi-cross-version",
    title: "OpenAPI 3.0 to 3.1 migration",
    spec: "openapi",
    group: "Versions",
    summary:
      'Documents of different 3.x versions are compared with the profile of the higher version, and representation-only changes are not reported: `nullable: true` and `type: [string, "null"]` mean the same, and so do `example` and `examples`. Only the `openapi` field itself changed.',
    before: `openapi: 3.0.3
info:
  title: Pet store
  version: 1.0.0
paths:
  /pets:
    get:
      responses:
        "200":
          description: A pet
          content:
            application/json:
              schema:
                type: object
                properties:
                  tag:
                    type: string
                    nullable: true
                    example: dog
`,
    after: `openapi: 3.1.0
info:
  title: Pet store
  version: 1.0.0
paths:
  /pets:
    get:
      responses:
        "200":
          description: A pet
          content:
            application/json:
              schema:
                type: object
                properties:
                  tag:
                    type: [string, "null"]
                    examples: [dog]
`,
    expected: [{ type: "annotation", action: "replace", path: "/openapi", scope: "root" }],
  },
  {
    id: "openapi-external-sources",
    title: "External $ref resolved from externalSources",
    spec: "openapi",
    group: "Components and $ref",
    summary:
      "The response refers to a schema in another file, `pet.json`, which is the schema itself (a `$ref` without a fragment names the whole document; `pet.json#/Pet` would name a part of it). Nothing is fetched: the referenced documents are passed per side in `externalSources`, keyed by their URI. The type of `name` in the external schema changed, which breaks the response; the editors hold only the referencing documents, the external ones are in the options.",
    before: petsApi(`    get:
      responses:
        "200":
          description: A pet
          content:
            application/json:
              schema:
                $ref: "https://example.com/schemas/pet.json"
`),
    after: petsApi(`    get:
      responses:
        "200":
          description: A pet
          content:
            application/json:
              schema:
                $ref: "https://example.com/schemas/pet.json"
`),
    options: {
      externalSources: {
        before: {
          "https://example.com/schemas/pet.json": {
            type: "object",
            properties: { id: { type: "string" }, name: { type: "string" } },
          },
        },
        after: {
          "https://example.com/schemas/pet.json": {
            type: "object",
            properties: { id: { type: "string" }, name: { type: "integer" } },
          },
        },
      },
    },
    optionsCode: `apiCompare(before, after, {
  externalSources: {
    before: {
      "https://example.com/schemas/pet.json": {
        type: "object",
        properties: { id: { type: "string" }, name: { type: "string" } },
      },
    },
    after: {
      "https://example.com/schemas/pet.json": {
        type: "object",
        properties: { id: { type: "string" }, name: { type: "integer" } },
      },
    },
  },
})`,
    expected: [
      {
        type: "breaking",
        action: "replace",
        path: "/paths/~1pets/get/responses/200/content/application~1json/schema/properties/name/type",
        scope: "response",
      },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // AsyncAPI
  {
    id: "asyncapi2-direction",
    title: "AsyncAPI 2.x publish and subscribe",
    spec: "asyncapi",
    group: "AsyncAPI",
    summary:
      "Direction is read from the client's point of view. `publish` messages are sent by clients to the application, so a new required payload property breaks them (like a request). `subscribe` messages are produced by the application, so a removed required property breaks the clients that read it (like a response).",
    before: `asyncapi: 2.6.0
info:
  title: Orders service
  version: 1.0.0
channels:
  order/cancel:
    publish:
      message:
        payload:
          type: object
          properties:
            orderId:
              type: string
  order/created:
    subscribe:
      message:
        payload:
          type: object
          required: [id, total]
          properties:
            id:
              type: string
            total:
              type: number
`,
    after: `asyncapi: 2.6.0
info:
  title: Orders service
  version: 1.0.0
channels:
  order/cancel:
    publish:
      message:
        payload:
          type: object
          required: [requestedBy]
          properties:
            orderId:
              type: string
            requestedBy:
              type: string
  order/created:
    subscribe:
      message:
        payload:
          type: object
          required: [id]
          properties:
            id:
              type: string
`,
    expected: [
      {
        type: "breaking",
        action: "add",
        path: "/channels/order~1cancel/publish/message/payload/properties/requestedBy",
        scope: "publish",
      },
      {
        type: "breaking",
        action: "add",
        path: "/channels/order~1cancel/publish/message/payload/required/0",
        scope: "publish",
      },
      {
        type: "breaking",
        action: "remove",
        path: "/channels/order~1created/subscribe/message/payload/required/1",
        scope: "subscribe",
      },
      {
        type: "breaking",
        action: "remove",
        path: "/channels/order~1created/subscribe/message/payload/properties/total",
        scope: "subscribe",
      },
    ],
  },
  {
    id: "asyncapi3-operations",
    title: "AsyncAPI 3.0 send and receive",
    spec: "asyncapi",
    group: "AsyncAPI",
    summary:
      "The same API as the 2.x example in AsyncAPI 3.0 spelling: a `receive` operation consumes messages (request semantics), a `send` operation produces them (response semantics), and the 2.x and 3.0 spellings get the same verdicts. The messages are components, so every change is reported at the message declaration and at the channel message that references it, classified by the operations that use the channel.",
    before: `asyncapi: 3.0.0
info:
  title: Orders service
  version: 1.0.0
channels:
  orderCancel:
    address: order/cancel
    messages:
      CancelOrder:
        $ref: "#/components/messages/CancelOrder"
  orderCreated:
    address: order/created
    messages:
      OrderCreated:
        $ref: "#/components/messages/OrderCreated"
operations:
  cancelOrder:
    action: receive
    channel:
      $ref: "#/channels/orderCancel"
  onOrderCreated:
    action: send
    channel:
      $ref: "#/channels/orderCreated"
components:
  messages:
    CancelOrder:
      payload:
        type: object
        properties:
          orderId:
            type: string
    OrderCreated:
      payload:
        type: object
        required: [id, total]
        properties:
          id:
            type: string
          total:
            type: number
`,
    after: `asyncapi: 3.0.0
info:
  title: Orders service
  version: 1.0.0
channels:
  orderCancel:
    address: order/cancel
    messages:
      CancelOrder:
        $ref: "#/components/messages/CancelOrder"
  orderCreated:
    address: order/created
    messages:
      OrderCreated:
        $ref: "#/components/messages/OrderCreated"
operations:
  cancelOrder:
    action: receive
    channel:
      $ref: "#/channels/orderCancel"
  onOrderCreated:
    action: send
    channel:
      $ref: "#/channels/orderCreated"
components:
  messages:
    CancelOrder:
      payload:
        type: object
        required: [requestedBy]
        properties:
          orderId:
            type: string
          requestedBy:
            type: string
    OrderCreated:
      payload:
        type: object
        required: [id]
        properties:
          id:
            type: string
`,
    expected: [
      {
        type: "breaking",
        action: "add",
        path: "/channels/orderCancel/messages/CancelOrder/payload/properties/requestedBy",
        scope: "components",
      },
      {
        type: "breaking",
        action: "add",
        path: "/channels/orderCancel/messages/CancelOrder/payload/required/0",
        scope: "components",
      },
      {
        type: "breaking",
        action: "remove",
        path: "/channels/orderCreated/messages/OrderCreated/payload/required/1",
        scope: "components",
      },
      {
        type: "breaking",
        action: "remove",
        path: "/channels/orderCreated/messages/OrderCreated/payload/properties/total",
        scope: "components",
      },
      {
        type: "breaking",
        action: "add",
        path: "/components/messages/CancelOrder/payload/properties/requestedBy",
        scope: "components",
      },
      {
        type: "breaking",
        action: "add",
        path: "/components/messages/CancelOrder/payload/required/0",
        scope: "components",
      },
      {
        type: "breaking",
        action: "remove",
        path: "/components/messages/OrderCreated/payload/required/1",
        scope: "components",
      },
      {
        type: "breaking",
        action: "remove",
        path: "/components/messages/OrderCreated/payload/properties/total",
        scope: "components",
      },
    ],
  },
  {
    id: "asyncapi3-channel-rename",
    title: "AsyncAPI 3.0 channel renamed",
    spec: "asyncapi",
    group: "Renames",
    summary:
      "The channel `userSignup` is renamed to `userRegistration` and the operation's `$ref` moved with it: one `rename` annotation. The changed `address` is reported on its own, and it is breaking: clients subscribe by address.",
    before: `asyncapi: 3.0.0
info:
  title: Users
  version: 1.0.0
channels:
  userSignup:
    address: user/signup
    messages:
      signup:
        payload:
          type: object
          properties:
            email:
              type: string
operations:
  onSignup:
    action: send
    channel:
      $ref: "#/channels/userSignup"
`,
    after: `asyncapi: 3.0.0
info:
  title: Users
  version: 1.0.0
channels:
  userRegistration:
    address: user/registration
    messages:
      signup:
        payload:
          type: object
          properties:
            email:
              type: string
operations:
  onSignup:
    action: send
    channel:
      $ref: "#/channels/userRegistration"
`,
    expected: [
      { type: "annotation", action: "rename", path: "/channels", scope: "root" },
      { type: "breaking", action: "replace", path: "/channels/userSignup/address", scope: "root" },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // JSON Schema
  {
    id: "jsonschema-validators",
    title: "JSON Schema validators",
    spec: "jsonschema",
    group: "JSON Schema",
    summary:
      "A standalone schema is read as the contract of the values a client sends (request semantics). A tighter `maxLength` and a raised `minimum` reject values that were valid: breaking. A new optional property and a property that is no longer required are non-breaking, and a changed `description` is an annotation.",
    before: `$schema: https://json-schema.org/draft/2020-12/schema
title: User
type: object
required: [name, age]
properties:
  name:
    type: string
    maxLength: 100
    description: The user's full name
  age:
    type: integer
    minimum: 18
`,
    after: `$schema: https://json-schema.org/draft/2020-12/schema
title: User
type: object
required: [name]
properties:
  name:
    type: string
    maxLength: 50
    description: Full name of the user
  age:
    type: integer
    minimum: 21
  email:
    type: string
    format: email
`,
    expected: [
      { type: "non-breaking", action: "remove", path: "/required/1", scope: "root" },
      { type: "breaking", action: "replace", path: "/properties/name/maxLength", scope: "root" },
      { type: "annotation", action: "replace", path: "/properties/name/description", scope: "root" },
      { type: "breaking", action: "replace", path: "/properties/age/minimum", scope: "root" },
      { type: "non-breaking", action: "add", path: "/properties/email", scope: "root" },
    ],
  },
  {
    id: "jsonschema-enum-type",
    title: "Enum values and type changes",
    spec: "jsonschema",
    group: "JSON Schema",
    summary:
      "Replacing the enum value `guest` with `owner` breaks clients that send `guest`. Widening `integer` to `number` accepts more values (non-breaking); changing `string` to `integer` is breaking.",
    before: `type: object
properties:
  role:
    type: string
    enum: [admin, user, guest]
  score:
    type: integer
  code:
    type: string
`,
    after: `type: object
properties:
  role:
    type: string
    enum: [admin, user, owner]
  score:
    type: number
  code:
    type: integer
`,
    expected: [
      { type: "breaking", action: "replace", path: "/properties/role/enum/2", scope: "root" },
      { type: "non-breaking", action: "replace", path: "/properties/score/type", scope: "root" },
      { type: "breaking", action: "replace", path: "/properties/code/type", scope: "root" },
    ],
  },
  {
    id: "jsonschema-equivalent",
    title: "Equivalent rewrites",
    spec: "jsonschema",
    group: "JSON Schema",
    summary:
      "`maxItems: 0` and `items: false` accept the same arrays: the rewrite is recognized and reported as one annotation, never as breaking. A list of types and an `anyOf` of single types are normalized to the same schema before the comparison, so that rewrite produces no diff at all.",
    before: `type: object
properties:
  tags:
    type: array
    maxItems: 0
  id:
    type: [string, integer]
`,
    after: `type: object
properties:
  tags:
    type: array
    items: false
  id:
    anyOf:
      - type: string
      - type: integer
`,
    expected: [{ type: "annotation", action: "replace", path: "/properties/tags", scope: "root" }],
  },
  {
    id: "jsonschema-allof",
    title: "allOf merged before comparing",
    spec: "jsonschema",
    group: "JSON Schema",
    summary:
      "`allOf` branches are merged (with allof-merge) before the comparison, so splitting a schema into `allOf` parts is no change at all; only the tightened `maxLength` is reported.",
    before: `type: object
required: [id]
properties:
  id:
    type: string
  name:
    type: string
    maxLength: 100
`,
    after: `allOf:
  - type: object
    required: [id]
    properties:
      id:
        type: string
  - type: object
    properties:
      name:
        type: string
        maxLength: 80
`,
    expected: [{ type: "breaking", action: "replace", path: "/properties/name/maxLength", scope: "root" }],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // GraphApi
  {
    id: "graphapi-fields",
    title: "GraphQL fields and arguments",
    spec: "graphapi",
    group: "GraphQL (GraphApi)",
    summary:
      "GraphQL is compared in its GraphApi 1.0 encoding (convert the SDL with gqlapi). A new non-null argument without a default breaks every query that does not pass it; an argument with a default is risky. Object types are named components, so field changes are reported at the type: a removed field is breaking, an added one non-breaking.",
    before: `graphapi: "1.0"
queryTypeName: Query
queries:
  books:
    args:
      first:
        type: Int
    type: list
    items:
      $ref: "#/components/objects/Book"
      nonNull: true
    nonNull: true
components:
  objects:
    Book:
      title: Book
      type: object
      methods:
        id:
          type: ID
          nonNull: true
        title:
          type: String
        isbn:
          type: String
`,
    after: `graphapi: "1.0"
queryTypeName: Query
queries:
  books:
    args:
      first:
        type: Int
      genre:
        type: String
        nonNull: true
      sort:
        type: String
        default: title
    type: list
    items:
      $ref: "#/components/objects/Book"
      nonNull: true
    nonNull: true
components:
  objects:
    Book:
      title: Book
      type: object
      methods:
        id:
          type: ID
          nonNull: true
        title:
          type: String
        year:
          type: Int
`,
    expected: [
      { type: "breaking", action: "add", path: "/queries/books/args/genre", scope: "args" },
      { type: "risky", action: "add", path: "/queries/books/args/sort", scope: "args" },
      { type: "breaking", action: "remove", path: "/components/objects/Book/methods/isbn", scope: "components" },
      { type: "non-breaking", action: "add", path: "/components/objects/Book/methods/year", scope: "components" },
    ],
  },
  {
    id: "graphapi-enums-unions",
    title: "GraphQL enums, unions and deprecation",
    spec: "graphapi",
    group: "GraphQL (GraphApi)",
    summary:
      "`Genre` and `SearchResult` are only returned, never sent. An enum value or union member added to an output type is risky (a client with an exhaustive match can receive a value it does not handle), while a removed enum value is non-breaking (the server simply never sends it). A field that gets a deprecation is `deprecated`.",
    before: `graphapi: "1.0"
queryTypeName: Query
queries:
  search:
    $ref: "#/components/unions/SearchResult"
  genre:
    $ref: "#/components/enums/Genre"
components:
  unions:
    SearchResult:
      title: SearchResult
      type: union
      oneOf:
        - $ref: "#/components/objects/Book"
  enums:
    Genre:
      title: Genre
      type: enum
      values:
        FICTION: {}
        SCIENCE: {}
        HISTORY: {}
  objects:
    Book:
      title: Book
      type: object
      methods:
        title:
          type: String
    Magazine:
      title: Magazine
      type: object
      methods:
        title:
          type: String
`,
    after: `graphapi: "1.0"
queryTypeName: Query
queries:
  search:
    $ref: "#/components/unions/SearchResult"
  genre:
    deprecation:
      reason: use genres
    $ref: "#/components/enums/Genre"
components:
  unions:
    SearchResult:
      title: SearchResult
      type: union
      oneOf:
        - $ref: "#/components/objects/Book"
        - $ref: "#/components/objects/Magazine"
  enums:
    Genre:
      title: Genre
      type: enum
      values:
        FICTION: {}
        SCIENCE: {}
        POETRY: {}
  objects:
    Book:
      title: Book
      type: object
      methods:
        title:
          type: String
    Magazine:
      title: Magazine
      type: object
      methods:
        title:
          type: String
`,
    expected: [
      { type: "deprecated", action: "add", path: "/queries/genre/deprecation", scope: "output" },
      { type: "risky", action: "add", path: "/components/unions/SearchResult/oneOf/1", scope: "components" },
      { type: "non-breaking", action: "remove", path: "/components/enums/Genre/values/HISTORY", scope: "components" },
      { type: "risky", action: "add", path: "/components/enums/Genre/values/POETRY", scope: "components" },
    ],
  },
  {
    id: "graphapi-012",
    title: "GraphApi 0.1.2 documents",
    spec: "graphapi",
    group: "GraphQL (GraphApi)",
    summary:
      "Documents written by gqlapi 0.5 and earlier (`graphapi: 0.1.2`) are compared with their own rule set and get the same verdicts as 1.0 documents. A field type changed from `String` to `Int` is breaking.",
    before: `graphapi: 0.1.2
queries:
  book:
    args:
      type: object
      properties:
        id:
          type: string
          format: ID
      required: [id]
    $ref: "#/components/objects/Book"
components:
  objects:
    Book:
      title: Book
      type: object
      properties:
        title:
          type: string
        year:
          type: string
`,
    after: `graphapi: 0.1.2
queries:
  book:
    args:
      type: object
      properties:
        id:
          type: string
          format: ID
      required: [id]
    $ref: "#/components/objects/Book"
components:
  objects:
    Book:
      title: Book
      type: object
      properties:
        title:
          type: string
        year:
          type: integer
`,
    expected: [
      { type: "breaking", action: "replace", path: "/components/objects/Book/properties/year", scope: "components" },
    ],
  },

  // ---------------------------------------------------------------------------------------------------------------
  // custom rules
  {
    id: "custom-extension-enum",
    title: "Custom rule for an extension",
    spec: "openapi",
    group: "Custom rules",
    summary:
      "By default every `x-*` change is an annotation. `options.extensions` gives `x-extensible-enum` enum semantics: its values are compared as a set (`enumMappingResolver`), an added value is non-breaking and a removed one is breaking. The built-in descriptions name each value and the extension, no description hook is needed. Without these options both diffs would be annotations.",
    before: petsApi(`    get:
      parameters:
        - name: kind
          in: query
          schema:
            type: string
            x-extensible-enum: [dog, cat, bird]
        - name: color
          in: query
          schema:
            type: string
            x-extensible-enum: [red]
      responses:
        "200":
          description: Pets
`),
    after: petsApi(`    get:
      parameters:
        - name: kind
          in: query
          schema:
            type: string
            x-extensible-enum: [dog, cat]
        - name: color
          in: query
          schema:
            type: string
            x-extensible-enum: [red, blue]
      responses:
        "200":
          description: Pets
`),
    options: {
      extensions: {
        "/x-extensible-enum": {
          compare: undefined,
          mapping: enumMappingResolver,
          "/*": { $: [nonBreaking, breaking, breaking] },
        },
      },
    },
    optionsCode: `import { apiCompare, breaking, enumMappingResolver, nonBreaking } from "api-smart-diff"

apiCompare(before, after, {
  extensions: {
    "/x-extensible-enum": {
      compare: undefined,           // walk the value with the child rules below
      mapping: enumMappingResolver, // values are compared as a set
      "/*": { $: [nonBreaking, breaking, breaking] },
    },
  },
})`,
    expected: [
      {
        type: "breaking",
        action: "remove",
        path: "/paths/~1pets/get/parameters/0/schema/x-extensible-enum/2",
        scope: "request",
      },
      {
        type: "non-breaking",
        action: "add",
        path: "/paths/~1pets/get/parameters/1/schema/x-extensible-enum/1",
        scope: "request",
      },
    ],
  },
  {
    id: "custom-extension-breaking",
    title: "A breaking extension",
    spec: "openapi",
    group: "Custom rules",
    summary:
      "An organization that treats its `x-internal` flag as part of the contract classifies every change of it as breaking with a custom rule. Other extensions stay annotations.",
    before: petsApi(`    get:
      x-owner: team-a
      responses:
        "200":
          description: Pets
`),
    after: petsApi(`    get:
      x-internal: true
      x-owner: team-b
      responses:
        "200":
          description: Pets
`),
    options: { extensions: { "/x-internal": { $: allBreaking } } },
    optionsCode: `import { allBreaking, apiCompare } from "api-smart-diff"

apiCompare(before, after, {
  extensions: { "/x-internal": { $: allBreaking } },
})`,
    expected: [
      { type: "annotation", action: "replace", path: "/paths/~1pets/get/x-owner", scope: "root" },
      { type: "breaking", action: "add", path: "/paths/~1pets/get/x-internal", scope: "root" },
    ],
  },
]

export const exampleById = (id: string): DiffExample => {
  const found = EXAMPLES.find((item) => item.id === id)
  if (!found) {
    throw new Error(`Unknown example: ${id}`)
  }
  return found
}

/** The heading id VitePress gives the section of an example (its title) */
export const exampleSlug = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
