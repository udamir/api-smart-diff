export const jsonSchemaTypes = [
  'any', 'string', 'number', 'integer', 'boolean', 'null', 'array', 'object'
] as const 

export const jsonSchemaNodeMetaProps = [
  'deprecated', 'readOnly', 'writeOnly', 'externalDocs'
] as const

export const jsonSchemaCommonProps = [
  'type', 'description', 'title', 'enum', 'default', 'examples', 'format', 'const'
] as const

export const jsonSchemaDefinitionsPath = ["$defs", "definitions"]

export const jsonSchemaValidators = {
  any:     [],
  boolean: [],
  null:    [],
  string:  ['minLength', 'maxLength', 'pattern'],
  number:  ['multipleOf', 'minimum', 'exclusiveMinimum', 'maximum', 'exclusiveMaximum'],
  integer: ['multipleOf', 'minimum', 'exclusiveMinimum', 'maximum', 'exclusiveMaximum'],
  object:  ['required', 'minProperties', 'maxProperties', 'propertyNames', 'properties', 'patternProperties', 'additionalProperties'],
  array:   ['minItems', 'maxItems', 'uniqueItems', 'items', 'additionalItems'],
} 

export const jsonSchemaTypeProps: Record<string, string[]> = {
  any:     [...jsonSchemaValidators.any,     ...jsonSchemaCommonProps, ...jsonSchemaNodeMetaProps],
  boolean: [...jsonSchemaValidators.boolean, ...jsonSchemaCommonProps, ...jsonSchemaNodeMetaProps],
  null:    [...jsonSchemaValidators.null,    ...jsonSchemaCommonProps, ...jsonSchemaNodeMetaProps],
  string:  [...jsonSchemaValidators.string,  ...jsonSchemaCommonProps, ...jsonSchemaNodeMetaProps],
  number:  [...jsonSchemaValidators.number,  ...jsonSchemaCommonProps, ...jsonSchemaNodeMetaProps],
  integer: [...jsonSchemaValidators.integer, ...jsonSchemaCommonProps, ...jsonSchemaNodeMetaProps],
  object:  [...jsonSchemaValidators.object,  ...jsonSchemaCommonProps, ...jsonSchemaNodeMetaProps],
  array:   [...jsonSchemaValidators.array,   ...jsonSchemaCommonProps, ...jsonSchemaNodeMetaProps],
}

export const jsonSchemaAllowedSibling = ["$defs", "definitions", "$schema", "$id"]
