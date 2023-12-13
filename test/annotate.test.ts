import { createTemplateFunc } from "../src"

describe("", () => {
  const dict = {
    "foo": "Hello {{world}}",
    "foo_name": "Hello {{name}}"
  }

  it("should create string from template with params", () => {
    const t = createTemplateFunc(dict)    
    expect(t("foo", { world: "World!" })).toEqual("Hello World!")
    expect(t("foo", { name: "Foo!", world: "World!" })).toEqual("Hello Foo!")
  })
})