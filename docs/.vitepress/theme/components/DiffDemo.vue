<script setup lang="ts">
import { withBase } from "vitepress"
import { computed, onMounted, ref, shallowRef, watch } from "vue"

import pkg from "../../../../package.json"
import type { CompareEngineName, CompareOptions, Diff, ProtoApiCompatibility } from "../../../../src"
import { errorLines } from "../analysis"
import {
  type DemoOptions,
  PROTO_LEVELS,
  PROTO_LEVEL_HINTS,
  type TextFormat,
  convertText,
  decodeStateAsync,
  encodeStateCompressed,
  formatOf,
  languageOf,
  serialize,
} from "../diff"
import { EXAMPLES } from "../examples"
import { workerRunner, useLiveAnalysis } from "../live"
import { PRESETS, PROTO_PRESET, SDL_PRESET } from "../presets"
import { type ReportBase, type ReportDiff, documentLanguage, engineOfLabel, protoSnippet, reportDiff } from "../report"
import type { DiffLocation } from "../location"
import CodeEditor from "./CodeEditor.vue"
import DiffResults from "./DiffResults.vue"
import ReportDialog from "./ReportDialog.vue"

// the curated examples whose options can be expressed by the demo controls (no custom rules or external sources)
const EXAMPLE_PRESETS = EXAMPLES.filter((example) => !example.options)
const SHOWCASE_PRESETS = [...PRESETS, SDL_PRESET, PROTO_PRESET]
const ALL_PRESETS = [...SHOWCASE_PRESETS, ...EXAMPLE_PRESETS]

const preset = ref<string>(PRESETS[0].id)
const before = ref("")
const after = ref("")
const format = ref<TextFormat>("yaml")
const merged = ref<"original" | "normalized">("original")
const components = ref<"usage" | "unclassified">("usage")
const engine = ref<"auto" | CompareEngineName>("auto")
const compatibility = ref<ProtoApiCompatibility>("FILE")
const tab = ref<"diffs" | "merged" | "errors">("diffs")
// the diffs tab as the table or as the raw `diffs` array in YAML
const view = ref<"table" | "yaml">("table")
const flash = ref("")

const loadPreset = (id: string) => {
  const found = ALL_PRESETS.find((item) => item.id === id)
  if (!found) {
    return
  }
  before.value = found.before
  after.value = found.after
  format.value = "yaml"
}

watch(preset, loadPreset)

const options = computed<CompareOptions>(() => {
  const result: CompareOptions = {}
  if (merged.value !== "original") {
    result.merged = merged.value
  }
  if (components.value !== "usage") {
    result.components = components.value
  }
  if (engine.value !== "auto") {
    result.engine = engine.value
  }
  if (compatibility.value !== "FILE") {
    ;(result as DemoOptions).compatibility = compatibility.value
  }
  return result
})

// the comparison runs in a web worker after a pause in typing (see live.ts): typing into a large document never waits
// for it, and an editor that does not parse keeps the last result, marked stale
const live = useLiveAnalysis(
  () => ({ before: before.value, after: after.value, options: options.value, format: format.value }),
  workerRunner(() => new Worker(new URL("../compare.worker.ts", import.meta.url), { type: "module" }) as never),
)

const comparison = computed(() => live.analysis.value?.comparison)
const diffs = computed(() => comparison.value?.result?.diffs ?? [])
const errors = computed(() => comparison.value?.errors ?? [])
const locations = computed(() => live.analysis.value?.locations)
const engineUsed = computed(() => live.analysis.value?.engine)
const mergedText = computed(() => live.analysis.value?.mergedText ?? "")
const sides = computed(() => live.latest.value?.sides)
const anySdl = computed(() => !!(sides.value?.before.sdl || sides.value?.after.sdl))
const anyProto = computed(() => !!(sides.value?.before.proto || sides.value?.after.proto))
// the compatibility select applies to ProtoApi documents (built from `.proto` input or given as YAML / JSON)
const protoApi = computed(
  () =>
    anyProto.value ||
    engine.value === "protoapi" ||
    /ProtoApi/.test(`${sides.value?.before.label} ${sides.value?.after.label}`),
)
const buildIssues = computed(() => live.latest.value?.buildIssues ?? [])

// a selected diff of `.proto` input highlights its source line in the editor of its side
const sourceLines = computed(() => live.analysis.value?.sourceLines)
const selected = ref<number>()
watch(sourceLines, () => (selected.value = undefined))
const selectedLine = computed(() => (selected.value === undefined ? undefined : sourceLines.value?.[selected.value]))
const highlightOf = (side: "before" | "after") =>
  selectedLine.value?.side === side ? { from: selectedLine.value.from, to: selectedLine.value.to } : undefined
const empty = computed(() => !before.value.trim() || !after.value.trim())

const code = computed(() => {
  const entries = Object.entries(options.value).map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
  return `const { diffs, merged } = apiCompare(before, after${entries.length ? `, { ${entries.join(", ")} }` : ""})`
})

// choosing another format rewrites both editors (convertText keeps text that does not parse, such as SDL)
const convertEditors = () => {
  before.value = convertText(before.value, format.value)
  after.value = convertText(after.value, format.value)
}

const notify = (message: string) => {
  flash.value = message
  setTimeout(() => (flash.value = ""), 1800)
}

const swap = () => {
  const text = before.value
  before.value = after.value
  after.value = text
}

const shareLink = async (): Promise<string> => {
  const hash = await encodeStateCompressed({
    before: before.value,
    after: after.value,
    options: options.value as DemoOptions,
  })
  return `${location.origin}${location.pathname}#${hash}`
}

const share = async () => {
  const url = await shareLink()
  history.replaceState(null, "", url)
  try {
    await navigator.clipboard.writeText(url)
    notify("Link copied")
  } catch {
    notify("Link in the address bar")
  }
}

const copyMerged = async () => {
  await navigator.clipboard.writeText(mergedText.value)
  notify("Merged document copied")
}

const download = (name: string, text: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }))
  const link = Object.assign(document.createElement("a"), { href: url, download: name })
  link.click()
  URL.revokeObjectURL(url)
}

// ---- report issue
const reporting = ref(false)
const reported = shallowRef<ReportDiff>()

const reportBase = computed<ReportBase>(() => {
  const label = sides.value?.before.label || sides.value?.after.label || "not detected"
  const forced = engine.value !== "auto" ? engine.value : undefined
  const detected = engineOfLabel(label)
  const engineNote = [
    ...(forced ? [`engine forced: ${forced}`] : detected ? [`engine ${detected}`] : []),
    ...(protoApi.value ? [`compatibility ${compatibility.value}`] : []),
  ]
  return {
    version: pkg.version,
    origin: "online demo",
    spec: `${label}${engineNote.length ? ` (${engineNote.join(", ")})` : ""}`,
    snippet: anyProto.value
      ? protoSnippet(
          compatibility.value === "FILE" ? undefined : compatibility.value,
          Object.entries(options.value)
            .filter(([key]) => key !== "compatibility")
            .map(([key, value]) => `${key}: ${JSON.stringify(value)}`),
        )
      : `import { apiCompare } from "api-smart-diff"\n\n// before, after: the documents below${anySdl.value ? " (GraphQL SDL converted with gqlapi: buildFromSchema(buildSchema(sdl)))" : ""}\n${code.value}`,
    diffs: diffs.value.map((diff, index) => reportDiff({ ...diff, location: locations.value?.[index]?.text })),
    failure: live.inputError.value ?? comparison.value?.failure,
    errors: errorLines(errors.value),
    before: {
      text: before.value,
      language: documentLanguage(before.value, sides.value?.before.sdl, sides.value?.before.proto),
    },
    after: {
      text: after.value,
      language: documentLanguage(after.value, sides.value?.after.sdl, sides.value?.after.proto),
    },
  }
})

const report = (diff?: Diff, location?: DiffLocation) => {
  reported.value = diff ? reportDiff({ ...diff, location: location?.text }) : undefined
  reporting.value = true
}

onMounted(async () => {
  const state = location.hash.length > 1 ? await decodeStateAsync(location.hash.slice(1)) : undefined
  if (!state) {
    loadPreset(preset.value)
    return
  }
  // a shared link (or an "Open in demo" link of the examples) wins over the preset
  preset.value = ALL_PRESETS.find((item) => item.before === state.before && item.after === state.after)?.id ?? ""
  before.value = state.before
  after.value = state.after
  format.value = formatOf(state.before)
  engine.value = state.options?.engine ?? "auto"
  merged.value = state.options?.merged ?? "original"
  components.value = state.options?.components ?? "usage"
  compatibility.value = state.options?.compatibility ?? "FILE"
})
</script>

<template>
  <div class="demo">
    <div class="toolbar">
      <label>
        Example
        <select v-model="preset">
          <option v-if="!preset" value="" disabled>Shared input</option>
          <optgroup label="Showcase (one per specification)">
            <option v-for="item in SHOWCASE_PRESETS" :key="item.id" :value="item.id">{{ item.title }}</option>
          </optgroup>
          <optgroup label="Curated examples">
            <option v-for="item in EXAMPLE_PRESETS" :key="item.id" :value="item.id">{{ item.title }}</option>
          </optgroup>
        </select>
      </label>
      <label>
        Format
        <select v-model="format" @change="convertEditors">
          <option value="yaml">YAML</option>
          <option value="json">JSON</option>
        </select>
      </label>
      <label title="options.engine: force an engine instead of detecting the specification">
        Engine
        <select v-model="engine">
          <option value="auto">detect</option>
          <option value="openapi">openapi</option>
          <option value="asyncapi">asyncapi</option>
          <option value="graphapi">graphapi</option>
          <option value="protoapi">protoapi</option>
          <option value="jsonschema">jsonschema</option>
        </select>
      </label>
      <label
        v-if="protoApi || compatibility !== 'FILE'"
        title="options.compatibility (ProtoApi): the clients and the generated code a change is judged for"
      >
        compatibility
        <select v-model="compatibility">
          <option v-for="level in PROTO_LEVELS" :key="level" :value="level" :title="PROTO_LEVEL_HINTS[level]">
            {{ level }}
          </option>
        </select>
      </label>
      <label title="options.merged: original input values or the normalized comparison values">
        merged
        <select v-model="merged">
          <option value="original">original</option>
          <option value="normalized">normalized</option>
        </select>
      </label>
      <label title="options.components: classify components.* by their usages, or leave them unclassified">
        components
        <select v-model="components">
          <option value="usage">usage</option>
          <option value="unclassified">unclassified</option>
        </select>
      </label>
    </div>

    <div class="panes">
      <section class="pane">
        <header>
          <span>Before <small>{{ sides?.before.label }}</small></span>
          <span class="actions">
            <button class="link" type="button" title="Swap before and after" @click="swap">⇄ Swap</button>
            <button class="link" type="button" :disabled="!before" @click="before = ''">Clear</button>
          </span>
        </header>
        <CodeEditor
          v-model="before"
          :language="languageOf(before)"
          label="Before document"
          :highlight="highlightOf('before')"
        />
      </section>
      <section class="pane">
        <header>
          <span>After <small>{{ sides?.after.label }}</small></span>
          <span class="actions">
            <span v-if="flash" class="flash" role="status">{{ flash }}</span>
            <button class="link" type="button" :disabled="!before && !after" @click="share">Share</button>
            <button class="link" type="button" :disabled="!after" @click="after = ''">Clear</button>
          </span>
        </header>
        <CodeEditor
          v-model="after"
          :language="languageOf(after)"
          label="After document"
          :highlight="highlightOf('after')"
        />
      </section>
    </div>

    <div class="code-line">
      <code>{{ code }}</code>
      <p v-if="anySdl" class="note">
        GraphQL SDL is converted first with gqlapi: <code>buildFromSchema(buildSchema(sdl))</code> gives a GraphApi 1.0
        document.
      </p>
      <p v-if="anyProto" class="note">
        <code>.proto</code> sources are built first with protoapi:
        <code>buildFromProto(files, &#123; imports: "user" &#125;)</code> gives a ProtoApi 0.1 document (a
        <code>// file: &lt;path&gt;</code> line starts a file; without one the editor is <code>api.proto</code>). Click
        a diff to highlight its source line.
      </p>
    </div>

    <div v-if="buildIssues.length" class="build-issues" role="status" aria-label="protoapi build issues">
      <div v-for="(issue, index) in buildIssues" :key="index" :class="issue.fatal ? 'fatal' : 'warning'">
        {{ issue.fatal ? "error" : "warning" }} {{ issue.text }}
      </div>
    </div>

    <section class="output">
      <div class="tabs" role="tablist">
        <button
          role="tab"
          type="button"
          :aria-selected="tab === 'diffs'"
          :class="{ active: tab === 'diffs' }"
          @click="tab = 'diffs'"
        >
          Diffs <small>{{ diffs.length }}</small>
        </button>
        <button
          role="tab"
          type="button"
          :aria-selected="tab === 'merged'"
          :class="{ active: tab === 'merged' }"
          @click="tab = 'merged'"
        >
          Merged document
        </button>
        <button
          role="tab"
          type="button"
          :aria-selected="tab === 'errors'"
          :class="{ active: tab === 'errors' }"
          @click="tab = 'errors'"
        >
          Errors <small>{{ errors.length }}</small>
        </button>
        <span class="tab-actions">
          <span v-if="live.busy.value && !empty" class="status" role="status">updating…</span>
          <span v-else-if="live.stale.value" class="status stale-label">stale</span>
          <template v-if="tab === 'merged' && mergedText">
            <button class="link" type="button" @click="copyMerged">Copy</button>
            <button class="link" type="button" @click="download(`merged.${format}`, mergedText)">Download</button>
          </template>
          <template v-if="tab === 'diffs' && diffs.length">
            <button class="link" type="button" @click="download('diffs.json', serialize(diffs, 'json'))">
              Download diffs
            </button>
          </template>
          <button
            class="link report-link"
            type="button"
            :disabled="empty"
            title="Report a wrong, missing or extra diff, a wrong description or a failure as a GitHub issue"
            @click="report()"
          >
            ⚑ Report issue
          </button>
        </span>
      </div>

      <div v-if="live.inputError.value && !empty" class="input-error" role="alert">
        <pre>{{ live.inputError.value }}</pre>
        <p v-if="live.stale.value">
          The result below is the last valid one (stale) and updates when both documents parse.
        </p>
      </div>
      <p v-if="empty" class="placeholder">Enter a before and an after document.</p>
      <p v-else-if="!comparison && !live.inputError.value" class="placeholder">Comparing…</p>
      <pre v-else-if="comparison?.failure" class="error" role="alert">{{ comparison.failure }}</pre>
      <div v-else-if="comparison" :class="{ stale: live.stale.value }" :aria-busy="live.busy.value">
        <DiffResults
          v-show="tab === 'diffs'"
          v-model:view="view"
          :diffs="diffs"
          :locations="locations"
          :engine="engineUsed"
          :source-lines="sourceLines"
          :selected="selected"
          label="Diffs as YAML"
          yaml-height="520px"
          reportable
          @report="report"
          @select="(index) => (selected = selected === index ? undefined : index)"
        />
        <div v-if="tab === 'merged'" class="merged">
          <p class="merged-note">
            The after document with the change metadata under <code>$diff</code> (see
            <a :href="withBase('/guide/result#merged-document')">the merged document</a>).
          </p>
          <CodeEditor :model-value="mergedText" :language="format" readonly label="Merged document" />
        </div>
        <div v-else-if="tab === 'errors'" class="errors">
          <p v-if="!errors.length" class="placeholder">
            No errors. Classifier, description, <code>$ref</code>, transform and mapping errors would be listed here
            (<code>options.onError</code>).
          </p>
          <pre v-else class="error">{{ errorLines(errors).join("\n") }}</pre>
        </div>
      </div>
    </section>

    <ReportDialog v-if="reporting" :base="reportBase" :diff="reported" :share="shareLink" @close="reporting = false" />
  </div>
</template>

<style scoped>
.demo {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 18px;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.toolbar select {
  margin-left: 6px;
  padding: 3px 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}

.panes {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
  height: calc(100vh - var(--vp-nav-height) - 300px);
  min-height: 420px;
}

@media (max-width: 960px) {
  .panes {
    grid-template-columns: minmax(0, 1fr);
    height: auto;
  }

  .pane {
    height: 420px;
  }
}

.pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  overflow: hidden;
  background: var(--vp-code-block-bg);
}

.pane header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 12px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--vp-c-divider);
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-2);
}

.pane header small {
  margin-left: 6px;
  font-weight: 500;
  color: var(--vp-c-text-3);
}

.actions,
.tab-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 14px;
}

.tab-actions {
  margin-left: auto;
}

.link {
  font-size: 13px;
  font-weight: 500;
  color: var(--vp-c-brand-1);
}

.link:disabled {
  color: var(--vp-c-text-3);
  cursor: default;
}

.flash {
  font-weight: 500;
  color: var(--vp-c-green-1);
}

.code-line {
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
  font-size: 13px;
  overflow-x: auto;
}

.code-line > code {
  font-family: var(--vp-font-family-mono);
  color: var(--vp-c-text-1);
  white-space: pre;
}

.note {
  margin: 6px 0 0;
  color: var(--vp-c-text-2);
}

.build-issues {
  padding: 8px 14px;
  border-radius: 10px;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  background: var(--vp-c-bg-soft);
}

.build-issues .fatal {
  color: var(--vp-c-danger-1);
}

.build-issues .warning {
  color: var(--vp-c-warning-1);
}

.output {
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 8px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.tabs [role="tab"] {
  padding: 5px 12px;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 500;
  color: var(--vp-c-text-2);
  transition:
    color 0.2s,
    background-color 0.2s;
}

.tabs [role="tab"]:hover {
  color: var(--vp-c-text-1);
}

.tabs [role="tab"].active {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-bg);
  box-shadow: var(--vp-shadow-1);
}

.tabs small {
  margin-left: 4px;
  color: var(--vp-c-text-3);
}

.merged {
  display: flex;
  flex-direction: column;
  height: 520px;
  background: var(--vp-code-block-bg);
}

.merged-note,
.placeholder {
  margin: 0;
  padding: 10px 14px;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.merged-note a {
  color: var(--vp-c-brand-1);
}

.status {
  font-size: 12px;
  color: var(--vp-c-text-3);
}

.stale-label {
  padding: 0 8px;
  border-radius: 999px;
  font-weight: 600;
  color: var(--vp-c-warning-1);
  background: var(--vp-c-warning-soft);
}

.report-link {
  color: var(--vp-c-text-2);
}

.report-link:hover:not(:disabled) {
  color: var(--vp-c-danger-1);
}

.input-error {
  padding: 10px 14px;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-danger-soft);
}

.input-error pre {
  margin: 0;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  white-space: pre-wrap;
  color: var(--vp-c-danger-1);
}

.input-error p {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.stale {
  opacity: 0.5;
  filter: grayscale(0.6);
  transition: opacity 0.2s;
}

.error {
  margin: 0;
  padding: 12px 14px;
  overflow: auto;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  color: var(--vp-c-danger-1);
}
</style>
