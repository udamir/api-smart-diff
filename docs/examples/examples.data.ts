/**
 * Highlights the options code of the examples at build time (the examples page shows it next to the live editors),
 * and lists the expected classes of each example for the page.
 */
import { createMarkdownRenderer, defineLoader } from "vitepress"

import { EXAMPLES } from "../.vitepress/theme/examples"

export interface ExampleData {
  /** highlighted HTML of the `apiCompare` call with the example's options */
  optionsHtml?: string
}

declare const data: Record<string, ExampleData>
export { data }

export default defineLoader({
  watch: ["../.vitepress/theme/examples.ts"],
  async load(): Promise<Record<string, ExampleData>> {
    const md = await createMarkdownRenderer(process.cwd())
    const result: Record<string, ExampleData> = {}
    for (const example of EXAMPLES) {
      result[example.id] = example.optionsCode
        ? { optionsHtml: await md.renderAsync("```ts\n" + example.optionsCode.trimEnd() + "\n```\n") }
        : {}
    }
    return result
  },
})
