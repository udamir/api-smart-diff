import { createTemplateAnnotation, annotationTemplate as t } from "../src"

describe("", () => {
  const dict = {
    "foo": "Hello {{world}}",
    "foo_name": "Hello {{name}}"
  }

  it("should create string from template with params", () => {  
    expect(createTemplateAnnotation(dict, t("foo", { world: "World!" }))).toEqual("Hello World!")
    expect(createTemplateAnnotation(dict, t("foo", { name: "Foo!", world: "World!" }))).toEqual("Hello Foo!")
  })
})