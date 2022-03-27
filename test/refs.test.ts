import { ExampleResource, replacePatch } from "./helpers"
import { breaking } from "../src"

const example = new ExampleResource("externalref.yaml", "OpenApi3")

describe("Test refs in openapi 3", () => {
  it("all external sources should be found", () => {
    const refs = example.findExternalSources()
    expect(refs.length).toEqual(2)
    expect(refs).toMatchObject(["http://swagger.io", "http://swagger.io/api"])
  })

  it("should dereference components from external refs", () => {
    example.externalSources = {
      "http://swagger.io": {
        components: {
          schemas: {
            Inventory: {
              type: "string"
            }
          }
        }
      }
    }
    
    const path = ["paths", "/store/inventory", "get", "responses", "200", "content", "application/json", "schema", "additionalProperties"]
    const oldValue = example.getValue(path)
    const value = {
      type: "object",
      properties: {
        id: {
          type: "string"
        }
      },
      "x-key-property": {
        $ref: 'http://swagger.io/api#/components/schemas/InvStatus'
      }
    }

    const after = example.clone([replacePatch(path, value)])
    const diff = example.diff(after)
    expect(diff.length).toEqual(2)
    expect(diff).toMatchObject([
      { path: [...path, "type"], before: oldValue.type, after: value.type, type: breaking },
      { path: [...path, "properties"], after: value.properties, type: breaking }
    ])
  })

})
