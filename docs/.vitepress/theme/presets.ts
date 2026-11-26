/**
 * Showcase document pairs of the online demo, one per specification: each pair has breaking, risky and annotation
 * changes among others (`test/docs/examples.test.ts` checks it). The curated examples are offered as presets too.
 * The input presets (GraphQL SDL, `.proto` sources) are converted before the comparison.
 */

export interface DemoPreset {
  id: string
  title: string
  before: string
  after: string
}

/** GraphQL SDL, converted to GraphApi 1.0 with gqlapi before the comparison */
export const SDL_PRESET: DemoPreset = {
  id: "graphql-sdl",
  title: "GraphQL SDL — books (converted with gqlapi)",
  before: `type Query {
  "Find books"
  books(first: Int = 10, genre: Genre): [Book!]!
  author(id: ID!): Author
}

enum Genre {
  FICTION
  SCIENCE
  HISTORY
}

type Book {
  id: ID!
  title: String!
  year: Int
  author: Author
}

type Author {
  id: ID!
  name: String!
  books: [Book!]!
}
`,
  after: `type Query {
  "Find books by genre"
  books(first: Int = 20, genre: Genre, sort: String = "title"): [Book!]!
  author(id: ID!): Author @deprecated(reason: "use authorById")
  authorById(id: ID!): Author
}

enum Genre {
  FICTION
  SCIENCE
  POETRY
}

type Book {
  id: ID!
  title: String!
  year: String
  author: Author!
}

type Author {
  id: ID!
  name: String!
  books: [Book!]!
}
`,
}

export const PRESETS: DemoPreset[] = [
  {
    id: "openapi",
    title: "OpenAPI 3.1 — pet store",
    before: `openapi: 3.1.0
info:
  title: Pet store
  version: 1.0.0
paths:
  /pets:
    get:
      operationId: listPets
      summary: List pets
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            maximum: 100
      responses:
        "200":
          description: A list of pets
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Pet"
    post:
      operationId: createPet
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/NewPet"
      responses:
        "201":
          description: Created
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Pet"
  /pets/{id}:
    get:
      operationId: getPet
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: A pet
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Pet"
        "404":
          description: Not found
components:
  schemas:
    Pet:
      type: object
      required: [id, name]
      properties:
        id:
          type: string
        name:
          type: string
        status:
          type: string
          enum: [available, sold]
        tag:
          type: string
    NewPet:
      type: object
      required: [name]
      properties:
        name:
          type: string
          maxLength: 50
        tag:
          type: string
`,
    after: `openapi: 3.1.0
info:
  title: Pet store
  version: 1.1.0
paths:
  /pets:
    get:
      operationId: listPets
      summary: List all pets
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            maximum: 50
        - name: owner
          in: query
          required: true
          schema:
            type: string
      responses:
        "200":
          description: A list of pets
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Pet"
    post:
      operationId: createPet
      x-rate-limit: 10
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/NewPet"
      responses:
        "201":
          description: Created
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Pet"
  /pets/{petId}:
    get:
      operationId: getPet
      deprecated: true
      parameters:
        - name: petId
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: A pet
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Pet"
components:
  schemas:
    Pet:
      type: object
      required: [id]
      properties:
        id:
          type: string
        name:
          type: string
        status:
          type: string
          enum: [available, pending, sold]
        tag:
          type: string
    NewPet:
      type: object
      required: [name]
      properties:
        name:
          type: string
          maxLength: 100
`,
  },
  {
    id: "asyncapi2",
    title: "AsyncAPI 2.6 — orders service",
    before: `asyncapi: 2.6.0
info:
  title: Orders service
  version: 1.0.0
channels:
  order/created:
    subscribe:
      operationId: onOrderCreated
      message:
        $ref: "#/components/messages/OrderCreated"
  order/cancel:
    publish:
      operationId: cancelOrder
      message:
        payload:
          type: object
          required: [orderId]
          properties:
            orderId:
              type: string
            reason:
              type: string
components:
  messages:
    OrderCreated:
      name: OrderCreated
      contentType: application/json
      payload:
        type: object
        required: [id, total]
        properties:
          id:
            type: string
          total:
            type: number
          currency:
            type: string
            enum: [EUR, USD]
`,
    after: `asyncapi: 2.6.0
info:
  title: Orders service
  version: 1.1.0
channels:
  order/created:
    subscribe:
      operationId: onOrderCreated
      description: Published after an order is stored
      message:
        $ref: "#/components/messages/OrderCreated"
  order/cancel:
    publish:
      operationId: cancelOrder
      message:
        payload:
          type: object
          required: [orderId, requestedBy]
          properties:
            orderId:
              type: string
            requestedBy:
              type: string
components:
  messages:
    OrderCreated:
      name: OrderCreated
      contentType: application/json
      payload:
        type: object
        required: [id]
        properties:
          id:
            type: string
          total:
            type: number
          currency:
            type: string
            enum: [EUR, USD, GBP]
`,
  },
  {
    id: "asyncapi3",
    title: "AsyncAPI 3.0 — orders service",
    before: `asyncapi: 3.0.0
info:
  title: Orders service
  version: 1.0.0
channels:
  orderCreated:
    address: order/created
    messages:
      OrderCreated:
        $ref: "#/components/messages/OrderCreated"
  orderCancel:
    address: order/cancel
    messages:
      CancelOrder:
        $ref: "#/components/messages/CancelOrder"
operations:
  onOrderCreated:
    action: send
    channel:
      $ref: "#/channels/orderCreated"
    messages:
      - $ref: "#/channels/orderCreated/messages/OrderCreated"
  cancelOrder:
    action: receive
    channel:
      $ref: "#/channels/orderCancel"
    messages:
      - $ref: "#/channels/orderCancel/messages/CancelOrder"
components:
  messages:
    OrderCreated:
      contentType: application/json
      payload:
        type: object
        required: [id, total]
        properties:
          id:
            type: string
          total:
            type: number
          currency:
            type: string
            enum: [EUR, USD]
    CancelOrder:
      payload:
        type: object
        required: [orderId]
        properties:
          orderId:
            type: string
          reason:
            type: string
`,
    after: `asyncapi: 3.0.0
info:
  title: Orders service
  version: 1.1.0
channels:
  orderCreated:
    address: orders/created
    messages:
      OrderCreated:
        $ref: "#/components/messages/OrderCreated"
  orderCancel:
    address: order/cancel
    messages:
      CancelOrder:
        $ref: "#/components/messages/CancelOrder"
operations:
  onOrderCreated:
    action: send
    summary: Published after an order is stored
    channel:
      $ref: "#/channels/orderCreated"
    messages:
      - $ref: "#/channels/orderCreated/messages/OrderCreated"
  cancelOrder:
    action: receive
    channel:
      $ref: "#/channels/orderCancel"
    messages:
      - $ref: "#/channels/orderCancel/messages/CancelOrder"
components:
  messages:
    OrderCreated:
      contentType: application/json
      payload:
        type: object
        required: [id]
        properties:
          id:
            type: string
          total:
            type: number
          currency:
            type: string
            enum: [EUR, USD, GBP]
    CancelOrder:
      payload:
        type: object
        required: [orderId, requestedBy]
        properties:
          orderId:
            type: string
          requestedBy:
            type: string
`,
  },
  {
    id: "jsonschema",
    title: "JSON Schema 2020-12 — user",
    before: `$schema: https://json-schema.org/draft/2020-12/schema
title: User
type: object
required: [name, age]
properties:
  name:
    type: string
    maxLength: 50
    description: The user's full name
  age:
    type: integer
    minimum: 18
  email:
    type: string
    format: email
  nickname:
    type: string
  role:
    type: string
    enum: [admin, user]
    default: user
  tags:
    type: array
    items:
      type: string
additionalProperties: false
`,
    after: `$schema: https://json-schema.org/draft/2020-12/schema
title: User
type: object
required: [name, age, email]
properties:
  name:
    type: string
    maxLength: 100
    description: Full name of the user
  age:
    type: integer
    minimum: 21
  email:
    type: string
    format: email
    deprecated: true
  role:
    type: string
    enum: [admin, user, guest]
    default: guest
  tags:
    type: array
    items:
      type: string
    maxItems: 10
additionalProperties: false
`,
  },
  {
    id: "graphapi",
    title: "GraphApi 1.0 — books (GraphQL)",
    before: `graphapi: '1.0'
queryTypeName: Query
queries:
  books:
    description: Find books
    args:
      first:
        type: Int
        default: 10
      genre:
        $ref: '#/components/enums/Genre'
    type: list
    items:
      $ref: '#/components/objects/Book'
      nonNull: true
    nonNull: true
  author:
    args:
      id:
        type: ID
        nonNull: true
    $ref: '#/components/objects/Author'
components:
  unions:
    SearchResult:
      title: SearchResult
      type: union
      oneOf:
        - $ref: '#/components/objects/Book'
        - $ref: '#/components/objects/Author'
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
        id:
          type: ID
          nonNull: true
        title:
          type: String
          nonNull: true
        year:
          type: Int
        author:
          $ref: '#/components/objects/Author'
    Author:
      title: Author
      type: object
      methods:
        id:
          type: ID
          nonNull: true
        name:
          type: String
          nonNull: true
        books:
          type: list
          items:
            $ref: '#/components/objects/Book'
            nonNull: true
          nonNull: true
`,
    after: `graphapi: '1.0'
queryTypeName: Query
queries:
  books:
    description: Find books by genre
    args:
      first:
        type: Int
        default: 20
      genre:
        $ref: '#/components/enums/Genre'
      sort:
        type: String
        default: title
    type: list
    items:
      $ref: '#/components/objects/Book'
      nonNull: true
    nonNull: true
  author:
    deprecation:
      reason: use authorById
    directives:
      - $ref: '#/components/directives/deprecated'
        meta:
          reason: use authorById
    args:
      id:
        type: ID
        nonNull: true
    $ref: '#/components/objects/Author'
  authorById:
    args:
      id:
        type: ID
        nonNull: true
    $ref: '#/components/objects/Author'
components:
  unions:
    SearchResult:
      title: SearchResult
      type: union
      oneOf:
        - $ref: '#/components/objects/Book'
        - $ref: '#/components/objects/Author'
        - $ref: '#/components/objects/Magazine'
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
        id:
          type: ID
          nonNull: true
        title:
          type: String
          nonNull: true
        year:
          type: String
        author:
          $ref: '#/components/objects/Author'
          nonNull: true
    Author:
      title: Author
      type: object
      methods:
        id:
          type: ID
          nonNull: true
        name:
          type: String
          nonNull: true
        books:
          type: list
          items:
            $ref: '#/components/objects/Book'
            nonNull: true
          nonNull: true
    Magazine:
      title: Magazine
      type: object
      methods:
        id:
          type: ID
          nonNull: true
        title:
          type: String
          nonNull: true
  directives:
    deprecated:
      title: deprecated
      description: Marks an element of a GraphQL schema as no longer supported.
      locations:
        - FIELD_DEFINITION
        - ARGUMENT_DEFINITION
        - INPUT_FIELD_DEFINITION
        - ENUM_VALUE
      args:
        reason:
          description: >-
            Explains why this element was deprecated, usually also including a suggestion for how to
            access supported similar data. Formatted using the Markdown syntax, as specified by
            [CommonMark](https://commonmark.org/).
          type: String
          default: No longer supported
      repeatable: false
`,
  },
  {
    id: "protoapi",
    title: "ProtoApi 0.1 — orders service (document built by protoapi)",
    before: `protoapi: '0.1'
files:
  shop/v1/shop.proto:
    syntax: proto3
    package: shop.v1
services:
  shop.v1.OrderService:
    title: OrderService
    file: shop/v1/shop.proto
    description: Orders of the shop.
    methods:
      CreateOrder:
        description: Creates an order.
        request:
          schema:
            $ref: '#/components/messages/shop.v1.CreateOrderRequest'
        response:
          schema:
            $ref: '#/components/messages/shop.v1.Order'
      GetOrder:
        description: Gets an order.
        request:
          schema:
            $ref: '#/components/messages/shop.v1.GetOrderRequest'
        response:
          schema:
            $ref: '#/components/messages/shop.v1.Order'
      CancelOrder:
        description: Cancels an order.
        request:
          schema:
            $ref: '#/components/messages/shop.v1.GetOrderRequest'
        response:
          schema:
            $ref: '#/components/messages/shop.v1.Order'
components:
  messages:
    shop.v1.Order:
      title: Order
      file: shop/v1/shop.proto
      description: An order.
      type: object
      properties:
        id:
          number: 1
          type: string
        customer_id:
          number: 2
          type: string
        status:
          number: 3
          $ref: '#/components/enums/shop.v1.Status'
        priority:
          number: 4
          type: int32
        note:
          number: 5
          type: string
    shop.v1.CreateOrderRequest:
      title: CreateOrderRequest
      file: shop/v1/shop.proto
      type: object
      properties:
        customer_id:
          number: 1
          type: string
        coupon:
          number: 2
          type: string
    shop.v1.GetOrderRequest:
      title: GetOrderRequest
      file: shop/v1/shop.proto
      type: object
      properties:
        id:
          number: 1
          type: string
  enums:
    shop.v1.Status:
      title: Status
      file: shop/v1/shop.proto
      description: Lifecycle of an order.
      type: string
      values:
        STATUS_UNSPECIFIED:
          number: 0
        STATUS_PENDING:
          number: 1
        STATUS_PAID:
          number: 2
`,
    after: `protoapi: '0.1'
files:
  shop/v1/shop.proto:
    syntax: proto3
    package: shop.v1
services:
  shop.v1.OrderService:
    title: OrderService
    file: shop/v1/shop.proto
    description: Orders of the shop.
    methods:
      CreateOrder:
        description: Creates an order.
        request:
          schema:
            $ref: '#/components/messages/shop.v1.CreateOrderRequest'
        response:
          schema:
            $ref: '#/components/messages/shop.v1.Order'
      GetOrder:
        description: Returns one order by its id.
        request:
          schema:
            $ref: '#/components/messages/shop.v1.GetOrderRequest'
        response:
          schema:
            $ref: '#/components/messages/shop.v1.Order'
components:
  messages:
    shop.v1.Order:
      title: Order
      file: shop/v1/shop.proto
      description: An order.
      type: object
      properties:
        id:
          number: 1
          type: string
        buyer_id:
          number: 2
          type: string
        status:
          number: 3
          $ref: '#/components/enums/shop.v1.Status'
        priority:
          number: 4
          type: int64
        note:
          deprecation: {}
          number: 5
          type: string
    shop.v1.CreateOrderRequest:
      title: CreateOrderRequest
      file: shop/v1/shop.proto
      type: object
      properties:
        customer_id:
          number: 1
          type: string
        coupon:
          number: 2
          type: string
        channel:
          number: 3
          type: string
    shop.v1.GetOrderRequest:
      title: GetOrderRequest
      file: shop/v1/shop.proto
      type: object
      properties:
        id:
          number: 1
          type: string
  enums:
    shop.v1.Status:
      title: Status
      file: shop/v1/shop.proto
      description: Lifecycle of an order.
      type: string
      values:
        STATUS_UNSPECIFIED:
          number: 0
        STATUS_PENDING:
          number: 1
        STATUS_PAID:
          number: 2
        STATUS_REFUNDED:
          number: 3
`,
  },
]

/**
 * Protocol Buffers sources, built with protoapi (`buildFromProto(files, { imports: "user" })`) before the comparison;
 * the same API as the ProtoApi preset. The `// file:` line names the file (an editor may hold several).
 */
export const PROTO_PRESET: DemoPreset = {
  id: "proto",
  title: "Protocol Buffers — orders service (.proto, built with protoapi)",
  before: `// file: shop/v1/shop.proto
syntax = "proto3";

package shop.v1;

// Orders of the shop.
service OrderService {
  // Creates an order.
  rpc CreateOrder(CreateOrderRequest) returns (Order);
  // Gets an order.
  rpc GetOrder(GetOrderRequest) returns (Order);
  // Cancels an order.
  rpc CancelOrder(GetOrderRequest) returns (Order);
}

// Lifecycle of an order.
enum Status {
  STATUS_UNSPECIFIED = 0;
  STATUS_PENDING = 1;
  STATUS_PAID = 2;
}

// An order.
message Order {
  string id = 1;
  string customer_id = 2;
  Status status = 3;
  int32 priority = 4;
  string note = 5;
}

message CreateOrderRequest {
  string customer_id = 1;
  string coupon = 2;
}

message GetOrderRequest {
  string id = 1;
}
`,
  after: `// file: shop/v1/shop.proto
syntax = "proto3";

package shop.v1;

// Orders of the shop.
service OrderService {
  // Creates an order.
  rpc CreateOrder(CreateOrderRequest) returns (Order);
  // Returns one order by its id.
  rpc GetOrder(GetOrderRequest) returns (Order);
}

// Lifecycle of an order.
enum Status {
  STATUS_UNSPECIFIED = 0;
  STATUS_PENDING = 1;
  STATUS_PAID = 2;
  STATUS_REFUNDED = 3;
}

// An order.
message Order {
  string id = 1;
  string buyer_id = 2;
  Status status = 3;
  int64 priority = 4;
  string note = 5 [deprecated = true];
}

message CreateOrderRequest {
  string customer_id = 1;
  string coupon = 2;
  string channel = 3;
}

message GetOrderRequest {
  string id = 1;
}
`,
}
