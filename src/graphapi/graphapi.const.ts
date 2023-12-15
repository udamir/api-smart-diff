export const graphApiComponents = {
  ScalarTypeDefinition: "scalars",
  ObjectTypeDefinition: "objects",
  InterfaceTypeDefinition: "interfaces",
  InputObjectTypeDefinition: "inputObjects",
  DirectiveDefinition: "directives",
  UnionTypeDefinition: "unions",
  EnumTypeDefinition: "enums"
} as const

export const graphApiOperations = {
  query: "query",
  mutation: "mutation",
  subscription: "subscription",
} as const

export const graphSchemaCustomProps = ["args", "values", "interfaces", "directives"] as const
