---
layout: home

hero:
  name: api-smart-diff
  text: Know what your API change breaks
  tagline: Compare two versions of an OpenAPI, AsyncAPI, JSON Schema or GraphQL (GraphApi) document and get every change, classified from the client's point of view and described in plain words — plus a merged document annotated with the changes.
  image:
    src: /logo.svg
    alt: api-smart-diff
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Try the online demo
      link: /demo
    - theme: alt
      text: Browse examples
      link: /examples/

features:
  - icon: 📚
    title: Four specifications
    details: OpenAPI 3.0, 3.1 and 3.2, AsyncAPI 2.x and 3.0, JSON Schema draft-04 to 2020-12, and GraphQL in its GraphApi 0.1.2 and 1.0 encodings — detected automatically.
    link: /guide/engines
    linkText: Specifications and engines
  - icon: 🚦
    title: Six classes of change
    details: Every diff is breaking, risky, non-breaking, deprecated, annotation or unclassified, so a release gate can fail on breaking changes and ask for a review of risky ones.
    link: /guide/classification
    linkText: Diff types
  - icon: ↔️
    title: Request or response
    details: The same change means different things in a request and in a response. Direction is explicit state — every diff reports the scope it was classified in, and components take the class of their usages.
    link: /guide/scopes
    linkText: Direction and scopes
  - icon: 📝
    title: Human-readable descriptions
    details: "“[Added] required status to <code>name</code> in Request Body content (application/json)” — every diff names the change, its location and its values."
    link: /guide/descriptions
    linkText: Descriptions
  - icon: 🧩
    title: Merged document
    details: The after document with the change metadata attached to every changed node, deep-copied, with <code>$ref</code>s, renames and array order handled — ready for a changelog view.
    link: /guide/result
    linkText: Result model
  - icon: 🛠️
    title: Rules you can change
    details: Specification support is a tree of rules. Override a classification, give an <code>x-*</code> extension real semantics or write your own description hook.
    link: /guide/custom-rules
    linkText: Custom rules
---
