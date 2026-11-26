<script setup lang="ts">
import { withBase } from "vitepress"
import { computed, onMounted, ref, shallowRef, watch } from "vue"

import pkg from "../../../../package.json"
import type { CompareOptions, Diff, ProtoApiCompatibility } from "../../../../src"
import { data } from "../../../examples/examples.data"
import { errorLines } from "../analysis"
import {
  PROTO_LEVELS,
  PROTO_LEVEL_HINTS,
  decodeStateAsync,
  encodeState,
  encodeStateCompressed,
  languageOf,
} from "../diff"
import { exampleById, exampleSlug } from "../examples"
import { pageRunner, useLiveAnalysis } from "../live"
import { type ReportBase, type ReportDiff, documentLanguage, engineOfLabel, protoSnippet, reportDiff } from "../report"
import type { DiffLocation } from "../location"
import CodeEditor from "./CodeEditor.vue"
import DiffResults from "./DiffResults.vue"
import ReportDialog from "./ReportDialog.vue"

const props = defineProps<{ id: string }>()

const example = computed(() => exampleById(props.id))
const extra = computed(() => data[props.id] ?? {})

const before = ref(example.value.before)
const after = ref(example.value.after)

// `.proto` examples: the compatibility level the example is compared at (documented for each level)
const level = ref<ProtoApiCompatibility>("FILE")
const options = computed<CompareOptions | undefined>(() =>
  example.value.levels ? ({ compatibility: level.value } as CompareOptions) : example.value.options,
)

// compared in the page after a pause in typing (the options of some examples hold functions, which a worker cannot
// receive); an editor that does not parse keeps the last result, marked stale (see live.ts)
const live = useLiveAnalysis(() => ({ before: before.value, after: after.value, options: options.value }), pageRunner())

const comparison = computed(() => live.analysis.value?.comparison)
const diffs = computed(() => comparison.value?.result?.diffs ?? [])
const errors = computed(() => comparison.value?.errors ?? [])
const locations = computed(() => live.analysis.value?.locations)
const engine = computed(() => live.analysis.value?.engine)
// the result as the table or as the raw `diffs` array in YAML
const view = ref<"table" | "yaml">("table")
const detected = computed(() => live.latest.value?.sides.before.label.replace(/ · (YAML|JSON)$/, "") ?? "")
const isProto = computed(() => !!(live.latest.value?.sides.before.proto || live.latest.value?.sides.after.proto))
const warnings = computed(() => (live.latest.value?.buildIssues ?? []).filter((issue) => !issue.fatal))

// a selected diff of `.proto` input highlights its source line
const sourceLines = computed(() => live.analysis.value?.sourceLines)
const selected = ref<number>()
const selectedLine = computed(() => (selected.value === undefined ? undefined : sourceLines.value?.[selected.value]))
const highlightOf = (side: "before" | "after") =>
  selectedLine.value?.side === side ? { from: selectedLine.value.from, to: selectedLine.value.to } : undefined
// a new result (another level, an edit) clears the selection
watch(sourceLines, () => (selected.value = undefined))

const edited = computed(() => before.value !== example.value.before || after.value !== example.value.after)

const height = (text: string) => `${Math.min(Math.max(text.split("\n").length, 6), 22) * 20.8 + 16}px`
const editorHeight = computed(() =>
  height(example.value.before.length > example.value.after.length ? example.value.before : example.value.after),
)

const yamlHeight = computed(() => `${Math.min(Math.max(diffs.value.length * 9, 8), 26) * 20.8 + 16}px`)

const reset = () => {
  before.value = example.value.before
  after.value = example.value.after
}

const demoLink = computed(() =>
  example.value.options
    ? ""
    : withBase(
        `/demo#${encodeState({
          before: before.value,
          after: after.value,
          ...(example.value.levels && level.value !== "FILE" ? { options: { compatibility: level.value } } : {}),
        })}`,
      ),
)

// ---- share link of the example (restores edited documents) and report issue
const shareLink = async (): Promise<string> => {
  const url = new URL(location.href)
  url.search = ""
  url.hash = exampleSlug(example.value.title)
  if (edited.value || level.value !== "FILE") {
    url.searchParams.set("example", example.value.id)
    url.searchParams.set(
      "state",
      await encodeStateCompressed({
        before: before.value,
        after: after.value,
        ...(level.value !== "FILE" ? { options: { compatibility: level.value } } : {}),
      }),
    )
  }
  return url.toString()
}

const reporting = ref(false)
const reported = shallowRef<ReportDiff>()

const reportBase = computed<ReportBase>(() => {
  const label = live.latest.value?.sides.before.label || "not detected"
  const engine = engineOfLabel(label)
  const proto = isProto.value
  return {
    version: pkg.version,
    origin: `example "${example.value.title}" (${example.value.id})${edited.value ? ", edited" : ""}`,
    spec: `${label}${engine ? ` (engine ${engine}${example.value.levels ? `, compatibility ${level.value}` : ""})` : ""}`,
    snippet: proto
      ? protoSnippet(level.value === "FILE" ? undefined : level.value)
      : `import { apiCompare } from "api-smart-diff"\n\n// before, after: the documents below\n${
          example.value.optionsCode?.replace(/^import [^\n]*\n+/, "") ?? "apiCompare(before, after)"
        }`,
    diffs: diffs.value.map((diff, index) => reportDiff({ ...diff, location: locations.value?.[index]?.text })),
    failure: live.inputError.value ?? comparison.value?.failure,
    errors: errorLines(errors.value),
    before: { text: before.value, language: documentLanguage(before.value, false, proto) },
    after: { text: after.value, language: documentLanguage(after.value, false, proto) },
  }
})

const report = (diff?: Diff, location?: DiffLocation) => {
  reported.value = diff ? reportDiff({ ...diff, location: location?.text }) : undefined
  reporting.value = true
}

// a share link of an edited example restores its documents
onMounted(async () => {
  const params = new URLSearchParams(location.search)
  const state = params.get("example") === props.id ? params.get("state") : null
  const restored = state ? await decodeStateAsync(state) : undefined
  if (restored) {
    before.value = restored.before
    after.value = restored.after
    if (example.value.levels && restored.options?.compatibility) {
      level.value = restored.options.compatibility
    }
  }
})
</script>

<template>
  <div class="diff-example">
    <div class="editors" :style="{ '--editor-height': editorHeight }">
      <section class="pane">
        <header>
          <span>Before</span>
          <small v-if="detected">{{ detected }}</small>
        </header>
        <CodeEditor
          v-model="before"
          :language="languageOf(before)"
          :label="`${example.title}: before document`"
          :highlight="highlightOf('before')"
        />
      </section>
      <section class="pane">
        <header>
          <span>After</span>
          <span class="actions">
            <button v-if="edited" class="link" type="button" @click="reset">Reset</button>
            <button
              class="link report-link"
              type="button"
              title="Report a wrong, missing or extra diff, a wrong description or a failure as a GitHub issue"
              @click="report()"
            >
              ⚑ Report issue
            </button>
            <a v-if="demoLink" class="link" :href="demoLink">Open in demo →</a>
          </span>
        </header>
        <CodeEditor
          v-model="after"
          :language="languageOf(after)"
          :label="`${example.title}: after document`"
          :highlight="highlightOf('after')"
        />
      </section>
    </div>

    <div v-if="example.levels" class="levels" role="group" aria-label="Compatibility level">
      <span class="caption">Compatibility level</span>
      <button
        v-for="item in PROTO_LEVELS"
        :key="item"
        type="button"
        :class="['level', { active: level === item }]"
        :aria-pressed="level === item"
        :title="PROTO_LEVEL_HINTS[item]"
        @click="level = item"
      >
        {{ item }}
      </button>
      <code class="call">apiCompare(before, after, { compatibility: "{{ level }}" })</code>
    </div>

    <div v-if="extra.optionsHtml" class="options">
      <p class="caption">Compared with these options (they are part of the example and cannot be edited here):</p>
      <div class="code" v-html="extra.optionsHtml" />
    </div>

    <div class="result">
      <div v-if="live.inputError.value" class="input-error" role="alert">
        <pre>{{ live.inputError.value }}</pre>
        <p v-if="live.stale.value">
          The result below is the last valid one (stale) and updates when both documents parse.
        </p>
      </div>
      <pre v-if="comparison?.failure" class="error" role="alert">{{ comparison.failure }}</pre>
      <div v-else-if="comparison" :class="{ stale: live.stale.value }" :aria-busy="live.busy.value">
        <DiffResults
          v-model:view="view"
          :diffs="diffs"
          :locations="locations"
          :engine="engine"
          :label="`${example.title}: diffs as YAML`"
          :yaml-height="yamlHeight"
          :source-lines="sourceLines"
          :selected="selected"
          compact
          reportable
          @report="report"
          @select="(index) => (selected = selected === index ? undefined : index)"
        />
        <pre v-if="warnings.length" class="warning">{{ warnings.map((issue) => issue.text).join("\n") }}</pre>
        <pre v-if="errors.length" class="error" role="alert">{{ errorLines(errors).join("\n") }}</pre>
      </div>
    </div>

    <ReportDialog v-if="reporting" :base="reportBase" :diff="reported" :share="shareLink" @close="reporting = false" />
  </div>
</template>

<style scoped>
.diff-example {
  margin: 16px 0 32px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
}

.editors {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  border-bottom: 1px solid var(--vp-c-divider);
}

@media (max-width: 720px) {
  .editors {
    grid-template-columns: minmax(0, 1fr);
  }
}

.pane {
  display: flex;
  flex-direction: column;
  height: calc(var(--editor-height) + 37px);
  min-width: 0;
  background: var(--vp-code-block-bg);
}

.pane + .pane {
  border-left: 1px solid var(--vp-c-divider);
}

.pane header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--vp-c-divider);
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-2);
}

.pane header small {
  font-weight: 500;
  color: var(--vp-c-text-3);
}

.actions {
  display: flex;
  gap: 14px;
}

.link {
  font-size: 13px;
  font-weight: 500;
  color: var(--vp-c-brand-1);
  text-decoration: none;
}

.link:hover {
  text-decoration: underline;
}

.levels {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--vp-c-divider);
  font-size: 13px;
}

.levels .caption {
  margin-right: 4px;
  color: var(--vp-c-text-2);
}

.level {
  padding: 1px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg);
}

.level.active {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.levels .call {
  margin-left: auto;
  font-size: 12px;
  color: var(--vp-c-text-3);
}

.warning {
  margin: 0;
  padding: 8px 14px;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  white-space: pre-wrap;
  color: var(--vp-c-warning-1);
}

.options {
  padding: 10px 14px 0;
  border-bottom: 1px solid var(--vp-c-divider);
}

.options .caption {
  margin: 0 !important;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.options .code :deep(div[class*="language-"]) {
  margin: 8px -14px 0 !important;
  border-radius: 0 !important;
}

.report-link {
  color: var(--vp-c-text-2);
}

.report-link:hover {
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
  padding: 10px 14px;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  color: var(--vp-c-danger-1);
}
</style>
