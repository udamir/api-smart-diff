import { ExampleResource } from "./helpers"
import { annotation, breaking, DiffAction, nonBreaking } from "../src"

const metaKey = Symbol("diff")
const exampleBefore = new ExampleResource("schema-before.graphql")
const exapmleAfter = new ExampleResource("schema-after.graphql")

describe("Test GraphApi difftree", () => {
  it("should create difftree for 2 graphql correctly", () => {
    const after = exapmleAfter.clone()
    const diffTree = exampleBefore.diffTree(after, { metaKey })

    expect(diffTree.queries[metaKey]).toMatchObject({ 
      NotificationsMeta: { type: breaking, action: DiffAction.remove } 
    })
    expect(diffTree.queries.Tweet[metaKey]).toMatchObject({ 
      required: { type: nonBreaking, action: DiffAction.remove } 
    })
    expect(diffTree.queries.Tweet.properties.Stats.properties[metaKey]).toMatchObject({ 
      responses: { type: nonBreaking, action: DiffAction.add },
    })
    expect(diffTree.queries.Tweets.items[metaKey]).toMatchObject({
      required: { type: nonBreaking, action: DiffAction.remove } 
    }),
    expect(diffTree.queries.Tweets.items.properties.Stats.properties[metaKey]).toMatchObject({
      responses: { type: nonBreaking, action: DiffAction.add },
    }),
    expect(diffTree.mutations.createTweet[metaKey]).toMatchObject({ 
      required: { type: nonBreaking, action: DiffAction.remove } 
    })
    expect(diffTree.mutations.createTweet.properties.Stats.properties[metaKey]).toMatchObject({ 
      responses: { type: nonBreaking, action: DiffAction.add },
    })
    expect(diffTree.mutations.deleteTweet[metaKey]).toMatchObject({ 
      required: { type: nonBreaking, action: DiffAction.remove } 
    })
    expect(diffTree.mutations.deleteTweet.properties.Stats.properties[metaKey]).toMatchObject({ 
      responses: { type: nonBreaking, action: DiffAction.add },
    })
    expect(diffTree.components.objects.Continent.properties.countries.items.properties.code[metaKey]).toMatchObject({ 
      format: { type: nonBreaking, action: DiffAction.remove },
    })
    expect(diffTree.components.objects.Continent.properties.countries.items.properties.states[metaKey]).toMatchObject({ 
      description: { type: annotation, action: DiffAction.remove },
    })
    expect(diffTree.components.objects.Continent.properties.countries.items.properties.languages.items.properties.code[metaKey]).toMatchObject({ 
      format: { type: nonBreaking, action: DiffAction.remove },
    })
  })
})
