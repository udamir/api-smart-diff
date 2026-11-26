<script setup lang="ts">
import { computed, ref } from "vue"

import type { Diff } from "../../../../src"
import { diffsYaml } from "../diff"
import CodeEditor from "./CodeEditor.vue"

// the raw `diffs` of the comparison as YAML, read-only, next to the table: the diffs the toolbar shows (type filter,
// search, sort; see results.ts), so Copy copies what is shown
const props = withDefaults(
  defineProps<{
    diffs: readonly Diff[]
    label: string
    height?: string
    /** the number of diffs of the comparison (default: all are shown) */
    total?: number
    /** the sort of the toolbar (`sorted by type ↑`), empty for the engine order */
    order?: string
  }>(),
  { height: "420px", total: undefined, order: "" },
)

const count = computed(() => {
  const total = props.total ?? props.diffs.length
  const unit = total === 1 ? "diff" : "diffs"
  return props.diffs.length === total ? `${total} ${unit}` : `${props.diffs.length} of ${total} ${unit}`
})

const text = computed(() => {
  try {
    return diffsYaml(props.diffs)
  } catch (error) {
    return `# the diffs cannot be shown as YAML: ${error instanceof Error ? error.message : String(error)}\n`
  }
})

const flash = ref("")
const copy = async () => {
  try {
    await navigator.clipboard.writeText(text.value)
    flash.value = "Copied"
  } catch {
    flash.value = "Copying is not allowed here"
  }
  setTimeout(() => (flash.value = ""), 1600)
}
</script>

<template>
  <div class="diffs-yaml">
    <div class="bar">
      <span class="note">
        <code>diffs</code> as returned by <code>apiCompare</code> ({{ count }}{{ order ? `, ${order}` : "" }})
      </span>
      <span v-if="flash" class="flash" role="status">{{ flash }}</span>
      <button class="link" type="button" title="Copy the diffs shown" @click="copy">Copy</button>
    </div>
    <div class="editor" :style="{ height }">
      <CodeEditor :model-value="text" language="yaml" readonly :label="label" />
    </div>
  </div>
</template>

<style scoped>
.diffs-yaml {
  display: flex;
  flex-direction: column;
  background: var(--vp-code-block-bg);
}

.bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 14px;
  border-bottom: 1px solid var(--vp-c-divider);
  font-size: 12px;
  color: var(--vp-c-text-2);
}

.note {
  margin-right: auto;
}

.note code {
  font-size: 12px;
}

.link {
  font-size: 13px;
  font-weight: 500;
  color: var(--vp-c-brand-1);
}

.flash {
  font-weight: 500;
  color: var(--vp-c-green-1);
}

.editor {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
</style>
