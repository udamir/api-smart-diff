import { jsonMerge } from "../src"

describe("", () => {

  it("should merge simple jsons", () => {
    const before = {
      foo: "baz",
      baz: {
        test: 1
      },
      arr: ["foo", "baz"]
    }

    const after = {
      foo: "world",
      baz: {
        test1: 2,
        foo: "test"
      },
      arr: ["foo", "baz1"]
    }

    const { diffs, merged } = jsonMerge(before, after)

    expect(diffs).toMatchObject([
      { action: "remove", before: 1 },
      { action: "add", after: 2 },
      { action: "add", after: "test" },
      { action: "replace", before: "baz", after: "world" },
      { action: "replace", before: "baz", after: "baz1" },
    ])
    expect(merged).toMatchObject({
      foo: "world",
      baz: {
        test: 1,
        test1: 2,
        foo: "test"
      },
      arr: ["foo", "baz1"]
    })

  })
})