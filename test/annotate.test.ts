import { createAnnotation, annotationTemplate as t } from "../src"

describe("", () => {
  const dict = {
    foo: "Hello {{world}}",
    foo_name: "Hello {{name}}",
  }

  it("should create string from template with params", () => {
    expect(createAnnotation(t("foo", { world: "World!" }), dict)).toEqual("Hello World!")
    expect(createAnnotation(t("foo", { name: "Foo!", world: "World!" }), dict)).toEqual("Hello Foo!")
  })
})
