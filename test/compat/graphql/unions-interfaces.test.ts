import { annotation, breaking, nonBreaking } from "../../../src"
import { type CaseSource, type CompatCase, type GraphqlCase, risky, runCases } from "../../helpers/compat"

const gql = (c: Omit<GraphqlCase, "kind">): CompatCase => ({ kind: "graphql", ...c })
const gi = (ref: string, verdict?: string): CaseSource => ({
  tool: "graphql-inspector",
  ref: `packages/core/__tests__/diff/${ref}`,
  ...(verdict ? { verdict } : {}),
})
const giChange = (ref: string, verdict?: string): CaseSource => ({
  tool: "graphql-inspector",
  ref: `packages/core/src/diff/changes/${ref}`,
  ...(verdict ? { verdict } : {}),
})
// a compat-suites case and the fork's expected verdict for it
const suite = (dir: string, id: string, verdict?: string): CaseSource[] => [
  { tool: "compat-suites", ref: `graphql/${dir}/${id}` },
  { tool: "fork", ref: `test/compatibility-suites/graphql/${dir}.test.ts ${id}`, ...(verdict ? { verdict } : {}) },
]
const asd = (ref: string): CaseSource => ({ tool: "asd", ref })

const QUERY = /quer(y|ies)/i

const members = "type Photo { url: String } type Video { url: String } type Audio { url: String }"
const un = (union: string) =>
  `type Query { search: [SearchResult] photo: Photo video: Video audio: Audio } union SearchResult = ${union} ${members}`
const UNION_SITES = ["queries/search/**", "components/unions/SearchResult/**"]

const ifaces = "interface Node { id: ID! } interface Named { name: String }"
const impl = (implementsClause: string) =>
  `type Query { item: Item node: Node named: Named } ${ifaces} type Item ${implementsClause} { id: ID! name: String }`
const IMPL_SITES = ["queries/item/**", "components/objects/Item/**", "components/interfaces/**"]
// the implementing type only: a diff under `components/interfaces` (a 1.0 `implementedBy` mirror) is spurious
const ITEM_SITES = ["components/objects/Item/**"]

const cases: CompatCase[] = [
  gql({
    id: "GQL-UNI-001",
    title: "union member added",
    before: "union SearchResult = Photo | Video",
    after: "union SearchResult = Photo | Video | Audio",
    rationale: "clients may receive Audio items they do not handle; no operation becomes invalid; POLICY-05: risky",
    annotation: "names the union and the added member (SearchResult, Audio)",
    sources: [
      gi("union.test.ts member added"),
      giChange("union.ts UNION_MEMBER_ADDED"),
      ...suite("union-output-type-of-root-type", "add-object-type-in-union-type"),
      asd("test/graphapi/classification.test.ts adding a union member is breaking"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findDangerousChanges should find all dangerous changes (UnionTypeThatGainsAType)",
      },
    ],
    covers: ["gi:UNION_MEMBER_ADDED", "gjs:TYPE_ADDED_TO_UNION"],
    sdl: [un("Photo | Video"), un("Photo | Video | Audio")],
    expect: [{ at: UNION_SITES, action: "add", type: risky, mentions: ["SearchResult", "Audio"] }],
    // ISSUE-130 (fixed): POLICY-05 decided (b); ISSUE-127 / 128 descriptions fixed in P7
  }),
  gql({
    id: "GQL-UNI-002",
    // ISSUE-115 (fixed)
    title: "union member removed",
    before: "union SearchResult = Photo | Video",
    after: "union SearchResult = Photo",
    rationale: "operations spreading `... on Video` inside `search` fail validation (fragment spread is not possible)",
    annotation: "names the union and the removed member (SearchResult, Video)",
    sources: [
      gi("union.test.ts member removed"),
      giChange("union.ts UNION_MEMBER_REMOVED"),
      ...suite("union-output-type-of-root-type", "remove-object-type-from-union-type"),
      asd("test/graphapi/classification.test.ts removing a union member is non-breaking (contradicts the spec)"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect all breaking changes (UnionTypeThatLosesAType)",
      },
    ],
    covers: ["gi:UNION_MEMBER_REMOVED", "gjs:TYPE_REMOVED_FROM_UNION"],
    sdl: [un("Photo | Video"), un("Photo")],
    expect: [{ at: UNION_SITES, action: "remove", type: breaking, mentions: ["SearchResult", "Video"] }],
  }),
  gql({
    id: "GQL-UNI-003",
    title: "union member replaced by another type",
    before: "union SearchResult = Photo | Video",
    after: "union SearchResult = Photo | Audio",
    rationale:
      "operations spreading `... on Video` fail validation, and clients may receive Audio (POLICY-05: risky); a replace that removes a member stays breaking",
    annotation: "names the union and both members (Video removed, Audio added)",
    sources: [
      ...suite("union-output-type-of-root-type", "change-object-type-in-union-type"),
      gi("union.test.ts member removed / member added", "BREAKING + DANGEROUS"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if a type was removed from a union type",
      },
    ],
    covers: ["gi:UNION_MEMBER_REMOVED", "gi:UNION_MEMBER_ADDED", "gjs:TYPE_REMOVED_FROM_UNION"],
    sdl: [un("Photo | Video"), un("Photo | Audio")],
    // POLICY-86 decided (P8a): a breaking remove plus a risky add (the former expectation also accepted one replace)
    expect: [
      { at: UNION_SITES, action: "remove", type: breaking, mentions: ["SearchResult", "Video"], count: 1 },
      { at: UNION_SITES, action: "add", type: risky, mentions: ["SearchResult", "Audio"], count: 1 },
    ],
    // ISSUE-115 (fixed); POLICY-05 decided (b): the added member alone would be risky
  }),
  gql({
    id: "GQL-UNI-004",
    title: "union members reordered (not a change)",
    before: "union SearchResult = Photo | Video",
    after: "union SearchResult = Video | Photo",
    rationale: "union members are a set; order is not significant",
    annotation: "no diff",
    sources: [gi("union.test.ts same members but different order")],
    sdl: [un("Photo | Video"), un("Video | Photo")],
    expect: [],
  }),
  gql({
    id: "GQL-UNI-005",
    // ISSUE-127 (fixed) (P8a)
    title: "union member added to a newly added union",
    before: "type Query { photo: Photo }",
    after: "type Query { photo: Photo search: SearchResult } union SearchResult = Photo",
    rationale: "the union is new, so adding it with its members breaks nobody",
    annotation: "names the added root field (Query.search) and the added union (SearchResult)",
    sources: [giChange("union.ts UNION_MEMBER_ADDED addedToNewType")],
    covers: ["gi:UNION_MEMBER_ADDED", "gi:TYPE_ADDED"],
    sdl: [
      "type Query { photo: Photo } type Photo { url: String }",
      "type Query { photo: Photo search: SearchResult } union SearchResult = Photo type Photo { url: String }",
    ],
    expect: [
      { at: "queries/search", action: "add", type: nonBreaking, mentions: [QUERY, "search"] },
      { at: "components/unions/SearchResult", action: "add", type: nonBreaking, mentions: ["SearchResult"] },
    ],
  }),
  gql({
    id: "GQL-IFC-001",
    title: "object type starts implementing an interface",
    before: "type Item { id: ID! name: String }",
    after: "type Item implements Node { id: ID! name: String }",
    rationale:
      "Item becomes a possible type of Node (returned by Query.node); no operation becomes invalid; POLICY-05: risky",
    annotation: "names the object type and the interface (Item implements Node)",
    sources: [
      gi("object.test.ts interfaces added"),
      giChange("object.ts OBJECT_TYPE_INTERFACE_ADDED"),
      ...suite("object-output-type-of-root-type-that-implements-interface", "add-interface-for-object-type", "no diff"),
      asd("test/graphapi/classification.test.ts implementing a first interface is neither breaking nor unclassified"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findDangerousChanges should find all dangerous changes (TypeThatGainsInterface1)",
      },
    ],
    covers: ["gi:OBJECT_TYPE_INTERFACE_ADDED", "gjs:IMPLEMENTED_INTERFACE_ADDED"],
    sdl: [impl(""), impl("implements Node")],
    expect: [{ at: IMPL_SITES, type: risky, mentions: ["Item", "Node"] }],
    // ISSUE-130 (fixed): POLICY-05 decided (b); ISSUE-127 / 128 descriptions fixed in P7
  }),
  gql({
    id: "GQL-IFC-002",
    title: "object type implements an additional interface",
    before: "type Item implements Node",
    after: "type Item implements Node & Named",
    rationale: "Item becomes a possible type of Named; no operation becomes invalid; POLICY-05: risky",
    annotation: "names the object type and the added interface (Item implements Named)",
    sources: [
      gi("object.test.ts interfaces added"),
      asd("test/graphapi/classification.test.ts implementing an additional interface is an annotation"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findDangerousChanges should detect interfaces added to types",
      },
    ],
    covers: ["gi:OBJECT_TYPE_INTERFACE_ADDED", "gjs:IMPLEMENTED_INTERFACE_ADDED"],
    sdl: [impl("implements Node"), impl("implements Node & Named")],
    expect: [{ at: IMPL_SITES, type: risky, mentions: ["Item", "Named"] }],
    // ISSUE-130 (fixed): POLICY-05 decided (b); ISSUE-127 / 128 descriptions fixed in P7
  }),
  gql({
    id: "GQL-IFC-003",
    // ISSUE-116 (fixed)
    title: "object type stops implementing an interface",
    before: "type Item implements Node & Named",
    after: "type Item implements Node",
    rationale:
      "operations spreading `... on Named` inside an Item selection fail validation, and Query.named can no longer return Item",
    annotation: "names the object type and the removed interface (Item, Named)",
    sources: [
      gi("object.test.ts interfaces removed"),
      giChange("object.ts OBJECT_TYPE_INTERFACE_REMOVED"),
      ...suite(
        "object-output-type-of-root-type-that-implements-interface",
        "delete-interface-for-object-type",
        "no diff",
      ),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect interfaces removed from types",
      },
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect all breaking changes (TypeThatLooseInterface1)",
      },
    ],
    covers: ["gi:OBJECT_TYPE_INTERFACE_REMOVED", "gjs:IMPLEMENTED_INTERFACE_REMOVED"],
    sdl: [impl("implements Node & Named"), impl("implements Node")],
    // POLICY-85 decided (a) (pinned in P8a): one diff, at the implementing type; no 1.0 `implementedBy` mirror diff
    expect: [{ at: ITEM_SITES, action: "remove", type: breaking, mentions: ["Item", "Named"], count: 1 }],
  }),
  gql({
    id: "GQL-IFC-004",
    // ISSUE-116 (fixed)
    title: "object type switches the interface it implements",
    before: "type Item implements Node",
    after: "type Item implements Named",
    rationale: "operations spreading `... on Node` inside an Item selection fail validation",
    annotation: "names the object type and both interfaces (Node removed, Named added)",
    sources: [
      ...suite(
        "object-output-type-of-root-type-that-implements-interface",
        "change-interface-for-object-type",
        "no diff",
      ),
      gi("object.test.ts interfaces removed"),
    ],
    covers: ["gi:OBJECT_TYPE_INTERFACE_REMOVED", "gi:OBJECT_TYPE_INTERFACE_ADDED"],
    sdl: [impl("implements Node"), impl("implements Named")],
    // POLICY-86 decided (P8a): a breaking remove plus a risky add, as for a union member replaced (GQL-UNI-003);
    // POLICY-85 decided (a): reported once, at the implementing type (no 1.0 `implementedBy` mirror diff)
    expect: [
      { at: ITEM_SITES, action: "remove", type: breaking, mentions: ["Item", "Node"], count: 1 },
      { at: ITEM_SITES, action: "add", type: risky, mentions: ["Item", "Named"], count: 1 },
    ],
  }),
  gql({
    id: "GQL-IFC-005",
    // ISSUE-124 (fixed)
    title: "interfaces implemented reordered (not a change)",
    before: "type Item implements Node & Named",
    after: "type Item implements Named & Node",
    rationale: "implemented interfaces are a set; order is not significant",
    annotation: "no diff",
    sources: [
      gi("union.test.ts same members but different order"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should ignore changes in order of interfaces",
      },
    ],
    sdl: [impl("implements Node & Named"), impl("implements Named & Node")],
    expect: [],
  }),
  gql({
    id: "GQL-IFC-006",
    // ISSUE-127 (fixed) (P8a)
    title: "new object type implementing an existing interface added",
    before: "interface Node { id: ID! } (Query.node)",
    after: "type Photo implements Node { id: ID! url: String } (Query.photo)",
    rationale:
      "a new type is not a change to existing ones; Node gains a possible type but the type is new (graphql-inspector addedToNewType: NON_BREAKING)",
    annotation: "names the added root field (Query.photo) and the added type (Photo)",
    sources: [giChange("object.ts OBJECT_TYPE_INTERFACE_ADDED addedToNewType")],
    covers: ["gi:TYPE_ADDED", "gi:OBJECT_TYPE_INTERFACE_ADDED"],
    sdl: [
      "type Query { node: Node } interface Node { id: ID! }",
      "type Query { node: Node photo: Photo } interface Node { id: ID! } type Photo implements Node { id: ID! url: String }",
    ],
    expect: [
      { at: "queries/photo", action: "add", type: nonBreaking, mentions: [QUERY, "photo"] },
      { at: "components/objects/Photo", action: "add", type: nonBreaking, mentions: ["Photo"] },
      // 1.0 lists the implementations of an interface (`implementedBy`): derived information
      { at: ["components/interfaces/Node/**", "queries/node/**"], type: annotation, optional: true },
    ],
  }),
  gql({
    id: "GQL-IFC-007",
    title: "interface starts implementing another interface",
    before: "interface Node { id: ID! } interface Resource { id: ID! url: String }",
    after: "interface Resource implements Node { id: ID! url: String }",
    rationale: "Resource implementations become possible types of Node; no operation becomes invalid; POLICY-05: risky",
    annotation: "names the interface and the implemented interface (Resource implements Node)",
    sources: [
      giChange("object.ts OBJECT_TYPE_INTERFACE_ADDED"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findDangerousChanges should detect interfaces added to interfaces",
      },
    ],
    covers: ["gi:OBJECT_TYPE_INTERFACE_ADDED", "gjs:IMPLEMENTED_INTERFACE_ADDED"],
    sdl: [
      "type Query { node: Node resource: Resource } interface Node { id: ID! } interface Resource { id: ID! url: String }",
      "type Query { node: Node resource: Resource } interface Node { id: ID! } interface Resource implements Node { id: ID! url: String }",
    ],
    expect: [{ at: ["queries/resource/**", "components/interfaces/**"], type: risky, mentions: ["Resource", "Node"] }],
    // ISSUE-130 (fixed): POLICY-05 decided (b); ISSUE-127 / 128 descriptions fixed in P7
  }),
]

runCases("graphql", "unions-interfaces", cases, import.meta.filename)
