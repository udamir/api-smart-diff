/**
 * GraphQL SDL input of the online demo: api-smart-diff compares GraphQL schemas in their GraphApi encoding, so SDL is
 * converted with gqlapi first (`buildFromSchema(buildSchema(sdl))`, a GraphApi 1.0 document). Loaded by the demo on
 * demand (when an editor holds SDL, see `looksLikeSdl` in diff.ts), so the other pages do not load graphql.
 */
import { buildSchema } from "graphql"
import { buildFromSchema } from "gqlapi"

export const sdlToGraphApi = (sdl: string): unknown => buildFromSchema(buildSchema(sdl))
