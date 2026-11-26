---
layout: page
title: Online demo
description: Compare two API documents in your browser with api-smart-diff and see every diff, its class, scope and description, and the merged document.
---

<script setup>
import DiffDemo from "./.vitepress/theme/components/DiffDemo.vue"
</script>

<div class="demo-page">

# Online demo

Compare two versions of an API document in your browser; the diff updates as you type. See **How to use** below the editors for details.

<ClientOnly>
<DiffDemo>
<template #help>

### Documents

Paste or edit two versions of an API document: OpenAPI 3.x, AsyncAPI 2.x / 3.0, JSON Schema, GraphApi or ProtoApi, as YAML or JSON. GraphQL SDL is converted to GraphApi with gqlapi first, and `.proto` sources are built into ProtoApi with [protoapi](/guide/protoapi), which the page loads only for them; their build issues are listed, and clicking a diff highlights its `.proto` line.

### Comparison

The specification is detected from the documents, and the comparison runs `apiCompare` from the current sources in your browser. The result updates a moment after you stop typing; the comparison runs in a web worker, so large documents do not block the editors. While a document does not parse, the parse error is shown and the last result stays, marked stale. The selects set the [options](/guide/options) `engine`, `merged` and `components`, and for ProtoApi the [compatibility level](/guide/protoapi#compatibility-levels).

### Results

- **Diffs** lists every diff with its [class](/guide/classification), API location (method and endpoint for OpenAPI; operation, channel and message for AsyncAPI; operation kind, field and arguments / output for GraphQL; rpc, declaration and element for ProtoApi) and [description](/guide/descriptions). **YAML** shows the raw `diffs` array instead, with the [scope](/guide/scopes) of every diff.
- The type chips and the search filter both views, and the **Type** and **Endpoint** headers sort them.
- **Merged document** shows the after document with the change metadata.
- **Errors** lists classifier, description, `$ref`, transform and mapping errors.

### Share and report

**Share** copies a link with both documents and the options; nothing is sent anywhere. If a diff looks wrong, or one is missing, **Report issue** (or the ⚑ of a row) prepares a GitHub issue with the documents, the options and a link to this state: you review it on GitHub and submit it yourself.

</template>
</DiffDemo>
</ClientOnly>

</div>

<style>
/* full viewport width (the editors and the result table span it); the intro text keeps a readable line length */
.demo-page {
  margin: 0 auto;
  padding: 32px 32px 48px;
}

@media (max-width: 640px) {
  .demo-page {
    padding: 24px 16px 40px;
  }
}

.demo-page h1 {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 8px;
}

.demo-page > p {
  max-width: var(--asd-prose-width);
  color: var(--vp-c-text-2);
  margin-bottom: 20px;
}

.demo-page > p a {
  color: var(--vp-c-brand-1);
  text-decoration: underline;
}
</style>
