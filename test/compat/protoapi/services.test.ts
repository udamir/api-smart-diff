import { runCases, type CompatCase } from "../../helpers/compat"
import { buf, cells, p3, parity, proto, row } from "./cases"

// PB-SVC: services and rpcs (PROTOAPI_DESIGN §6.2), re-authored from buf's breaking corpus and the parity scenarios

const msgs = "message A { string id = 1; }\nmessage B { string id = 1; }\nmessage C { string id = 1; }\n"
const svc = (body: string) => p3(`${msgs}service S {\n${body}\n}`)
const S = "services/p.S"

const cases: CompatCase[] = [
  proto({
    id: "PB-SVC-001",
    title: "service deleted",
    before: "service S { … } service T { rpc A(R) returns (R); }",
    after: "service S { … }",
    rationale: "every call to the service fails with UNIMPLEMENTED (PD-1, stricter than buf in WIRE_JSON / WIRE)",
    annotation: "names the deleted service and its file",
    sources: [
      parity("s service_deleted", "SERVICE_NO_DELETE F; PACKAGE_SERVICE_NO_DELETE P"),
      buf("breaking_service_no_delete", "SERVICE_NO_DELETE F"),
      buf("breaking_package_service_no_delete", "PACKAGE_SERVICE_NO_DELETE P"),
      row("S-2"),
    ],
    covers: ["buf:SERVICE_NO_DELETE", "buf:PACKAGE_SERVICE_NO_DELETE"],
    proto: [
      p3(`${msgs}service S { rpc Get(A) returns (B); }\nservice T { rpc Get(A) returns (B); }`),
      p3(`${msgs}service S { rpc Get(A) returns (B); }`),
    ],
    expect: [{ at: "services/p.T", action: "remove", type: cells("B B B B"), mentions: ["`p.T`"] }],
  }),
  proto({
    id: "PB-SVC-002",
    title: "rpc deleted",
    before: "service S { rpc A(R) returns (R); rpc B(R) returns (R); }",
    after: "service S { rpc A(R) returns (R); }",
    rationale: "calls fail with UNIMPLEMENTED at every level (PD-1)",
    annotation: "names the rpc and the service",
    sources: [
      parity("r rpc_deleted", "RPC_NO_DELETE F P"),
      buf("breaking_rpc_no_delete", "RPC_NO_DELETE F P"),
      row("R-2"),
    ],
    covers: ["buf:RPC_NO_DELETE"],
    proto: [svc("rpc Get(A) returns (B);\nrpc List(A) returns (B);"), svc("rpc Get(A) returns (B);")],
    expect: [{ at: `${S}/methods/List`, action: "remove", type: cells("B B B B"), mentions: ["`List`", "`p.S`"] }],
  }),
  proto({
    id: "PB-SVC-003",
    title: "rpc added",
    before: "service S { rpc Get(A) returns (B); }",
    after: "service S { rpc Get(A) returns (B); rpc List(A) returns (B); }",
    rationale: "a new method breaks no client",
    annotation: "names the rpc and the service",
    sources: [row("R-1")],
    proto: [svc("rpc Get(A) returns (B);"), svc("rpc Get(A) returns (B);\nrpc List(A) returns (B);")],
    expect: [{ at: `${S}/methods/List`, action: "add", type: cells("N N N N"), mentions: ["`List`"] }],
  }),
  proto({
    id: "PB-SVC-004",
    title: "request retargeted to another message",
    before: "rpc Get(A) returns (B)",
    after: "rpc Get(C) returns (B)",
    rationale: "two different messages whose bodies are not compared with each other; reflection names change (TC-2)",
    annotation: "names the rpc and both request types",
    sources: [buf("breaking_rpc_same_values", "RPC_SAME_REQUEST_TYPE F P J W"), row("R-3")],
    covers: ["buf:RPC_SAME_REQUEST_TYPE"],
    proto: [svc("rpc Get(A) returns (B);"), svc("rpc Get(C) returns (B);")],
    expect: [
      { at: `${S}/methods/Get/request`, action: "replace", type: cells("R R R R"), mentions: ["`p.A`", "`p.C`"] },
    ],
  }),
  proto({
    id: "PB-SVC-005",
    title: "response retargeted to another message",
    before: "rpc Get(A) returns (B)",
    after: "rpc Get(A) returns (C)",
    rationale: "two different messages whose bodies are not compared with each other (TC-2)",
    annotation: "names the rpc and both response types",
    sources: [buf("breaking_rpc_same_values", "RPC_SAME_RESPONSE_TYPE F P J W"), row("R-4")],
    covers: ["buf:RPC_SAME_RESPONSE_TYPE"],
    proto: [svc("rpc Get(A) returns (B);"), svc("rpc Get(A) returns (C);")],
    expect: [
      { at: `${S}/methods/Get/response`, action: "replace", type: cells("R R R R"), mentions: ["`p.B`", "`p.C`"] },
    ],
  }),
  proto({
    id: "PB-SVC-006",
    title: "client streaming added",
    before: "rpc Get(A) returns (B)",
    after: "rpc Get(stream A) returns (B)",
    rationale: "unary and streaming calls are different call types for every client (S5)",
    annotation: "names the rpc and both request sides",
    sources: [buf("breaking_rpc_same_values", "RPC_SAME_CLIENT_STREAMING F P J W"), row("R-5")],
    covers: ["buf:RPC_SAME_CLIENT_STREAMING"],
    proto: [svc("rpc Get(A) returns (B);"), svc("rpc Get(stream A) returns (B);")],
    expect: [{ at: `${S}/methods/Get/request`, action: "replace", type: cells("B B B B"), mentions: ["`stream p.A`"] }],
  }),
  proto({
    id: "PB-SVC-007",
    title: "server streaming removed together with a response retarget: one record (S5)",
    before: "rpc Get(A) returns (stream B)",
    after: "rpc Get(A) returns (C)",
    rationale: "the call type changes for every client; the retarget is part of the same side record (S5)",
    annotation: "names the rpc and both response sides",
    sources: [
      buf("breaking_rpc_same_values", "RPC_SAME_SERVER_STREAMING F P J W; RPC_SAME_RESPONSE_TYPE F P J W"),
      row("R-6"),
    ],
    covers: ["buf:RPC_SAME_SERVER_STREAMING"],
    proto: [svc("rpc Get(A) returns (stream B);"), svc("rpc Get(A) returns (C);")],
    expect: [
      {
        at: `${S}/methods/Get/response`,
        action: "replace",
        type: cells("B B B B"),
        mentions: ["`stream p.B`", "`p.C`"],
      },
    ],
  }),
  proto({
    id: "PB-SVC-008",
    title: "idempotency level removed",
    before: "rpc Get(A) returns (B) { option idempotency_level = NO_SIDE_EFFECTS; }",
    after: "rpc Get(A) returns (B);",
    rationale: "clients and proxies stop retrying or caching the call; nothing fails (G5)",
    annotation: "names the rpc and the idempotency level",
    sources: [
      parity("f idempotency_removed", "RPC_SAME_IDEMPOTENCY_LEVEL F P J W"),
      buf("breaking_rpc_same_values"),
      row("R-8"),
    ],
    covers: ["buf:RPC_SAME_IDEMPOTENCY_LEVEL"],
    proto: [
      svc("rpc Get(A) returns (B) {\n  option idempotency_level = NO_SIDE_EFFECTS;\n}"),
      svc("rpc Get(A) returns (B);"),
    ],
    expect: [
      { at: `${S}/methods/Get/idempotency`, action: "remove", type: cells("R R R R"), mentions: ["NO_SIDE_EFFECTS"] },
    ],
  }),
  proto({
    id: "PB-SVC-009",
    title: "idempotency level added",
    before: "rpc Get(A) returns (B);",
    after: "rpc Get(A) returns (B) { option idempotency_level = IDEMPOTENT; }",
    rationale: "a stronger guarantee: clients may retry more (G5)",
    annotation: "names the rpc and the idempotency level",
    sources: [parity("g idempotency_added", "RPC_SAME_IDEMPOTENCY_LEVEL F P J W"), row("R-7")],
    proto: [
      svc("rpc Get(A) returns (B);"),
      svc("rpc Get(A) returns (B) {\n  option idempotency_level = IDEMPOTENT;\n}"),
    ],
    expect: [{ at: `${S}/methods/Get/idempotency`, action: "add", type: cells("N N N N"), mentions: ["IDEMPOTENT"] }],
  }),
]

runCases("protoapi", "services", cases, import.meta.filename)
