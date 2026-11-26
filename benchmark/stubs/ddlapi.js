"use strict"
// Stub for `@netcracker/qubership-apihub-ddlapi`, which is published only on GitHub Packages and is not available
// here (never installed from any registry). The fork (api-diff) and the unifier import only enum-like constant
// objects and one string constant from it, used to build the DDL API rule trees at module load time. Every member
// access returns the member name as a string, which is enough for the rule tables to be constructed; the DDL code
// path itself is never exercised by this benchmark (only OpenAPI / AsyncAPI / JSON Schema / GraphAPI documents).
const enumStub = (name) =>
  new Proxy(Object.create(null), {
    get: (_target, prop) => {
      if (typeof prop === "symbol" || prop === "then" || prop === "toJSON") return undefined
      return `${name}.${String(prop)}`
    },
    has: () => true,
    ownKeys: () => [],
    getOwnPropertyDescriptor: () => undefined,
  })

module.exports = {
  DdlapiProperties: enumStub("DdlapiProperties"),
  AttrKind: enumStub("AttrKind"),
  ExprKind: enumStub("ExprKind"),
  ObjectKind: enumStub("ObjectKind"),
  ReferenceOption: enumStub("ReferenceOption"),
  TypeKind: enumStub("TypeKind"),
  SqlTypeName: enumStub("SqlTypeName"),
  PgSqlTypeName: enumStub("PgSqlTypeName"),
  PgAttrKind: enumStub("PgAttrKind"),
  PgGeneratedExprType: enumStub("PgGeneratedExprType"),
  PgObjectKind: enumStub("PgObjectKind"),
  PgTypeKind: enumStub("PgTypeKind"),
  PG_DEFAULT_SCHEMA: "public",
}
