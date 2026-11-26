import { defineConfig } from "vitepress"

import pkg from "../../package.json" with { type: "json" }
import { EXAMPLES, exampleSlug as slug } from "./theme/examples"

const GUIDE = {
  text: "Guide",
  items: [
    { text: "What is api-smart-diff?", link: "/guide/" },
    { text: "Getting started", link: "/guide/getting-started" },
    { text: "Installation", link: "/guide/installation" },
    { text: "Usage", link: "/guide/usage" },
    { text: "Specifications and engines", link: "/guide/engines" },
    { text: "Protocol Buffers (ProtoApi)", link: "/guide/protoapi" },
    { text: "Options", link: "/guide/options" },
    { text: "Result", link: "/guide/result" },
  ],
}

const CONCEPTS = {
  text: "Classification",
  items: [
    { text: "Diff types", link: "/guide/classification" },
    { text: "Direction and scopes", link: "/guide/scopes" },
    { text: "Components and $ref", link: "/guide/components" },
    { text: "Renames", link: "/guide/renames" },
    { text: "Descriptions", link: "/guide/descriptions" },
  ],
}

const ADVANCED = {
  text: "Advanced",
  items: [
    { text: "Custom rules", link: "/guide/custom-rules" },
    { text: "Specification extensions", link: "/guide/extensions" },
    { text: "Limitations", link: "/guide/limitations" },
    { text: "Migration from 1.x", link: "/guide/migration" },
    { text: "API reference", link: "/guide/api" },
    { text: "Contributing", link: "/guide/contributing" },
  ],
}

const groups = [...new Set(EXAMPLES.map((item) => item.group))]
const EXAMPLE_GROUPS = groups.map((group) => ({
  text: group,
  collapsed: false,
  items: EXAMPLES.filter((item) => item.group === group).map((item) => ({
    text: item.title,
    link: `/examples/#${slug(item.title)}`,
  })),
}))

const TOOLS = {
  text: "Tools",
  items: [
    { text: "Online demo", link: "/demo" },
    { text: "Examples", link: "/examples/" },
    { text: "API reference", link: "/guide/api" },
    { text: "Changelog", link: "/changelog" },
  ],
}

export default defineConfig({
  title: "api-smart-diff",
  description:
    "Compare OpenAPI, AsyncAPI, JSON Schema, GraphQL (GraphApi) and Protocol Buffers (ProtoApi) documents: diffs, a merged document with change metadata, breaking-change classification and human-readable descriptions.",
  // served from https://udamir.github.io/api-smart-diff/
  base: "/api-smart-diff/",
  cleanUrls: true,
  lastUpdated: true,
  head: [["link", { rel: "icon", type: "image/svg+xml", href: "/api-smart-diff/logo.svg" }]],
  vite: {
    // the demo compares in a module worker (compare.worker.ts), which loads the GraphQL SDL converter on demand
    worker: { format: "es" },
    build: {
      // the demo and the examples bundle the engine (and load graphql + gqlapi on demand for SDL input, protoapi for
      // `.proto` input)
      chunkSizeWarningLimit: 1600,
    },
  },
  themeConfig: {
    logo: "/logo.svg",
    nav: [
      { text: "Guide", link: "/guide/", activeMatch: "/guide/" },
      { text: "Examples", link: "/examples/", activeMatch: "/examples/" },
      { text: "API", link: "/guide/api" },
      { text: "Demo", link: "/demo" },
      {
        text: `v${pkg.version}`,
        items: [
          { text: "Changelog", link: "/changelog" },
          { text: "Migration from 1.x", link: "/guide/migration" },
          { text: "npm", link: "https://www.npmjs.com/package/api-smart-diff" },
        ],
      },
    ],
    sidebar: {
      "/guide/": [GUIDE, CONCEPTS, ADVANCED, TOOLS],
      "/examples/": [...EXAMPLE_GROUPS, TOOLS],
      "/changelog": [GUIDE, CONCEPTS, ADVANCED, TOOLS],
    },
    outline: { level: [2, 3] },
    search: { provider: "local" },
    socialLinks: [{ icon: "github", link: "https://github.com/udamir/api-smart-diff" }],
    editLink: {
      pattern: "https://github.com/udamir/api-smart-diff/edit/master/docs/:path",
      text: "Edit this page on GitHub",
    },
    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © Damir Yusipov",
    },
  },
})
