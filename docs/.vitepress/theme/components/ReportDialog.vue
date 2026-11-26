<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from "vue"

import type { DiffType } from "../../../../src"
import { DIFF_TYPES } from "../diff"
import {
  type ProblemKind,
  type ReportBase,
  type ReportDiff,
  MAX_URL_LENGTH,
  PROBLEM_KINDS,
  buildReport,
} from "../report"

const props = defineProps<{
  base: ReportBase
  /** the diff of a row ("this diff is wrong"); absent for a report about the whole result */
  diff?: ReportDiff
  /** builds the portal link that restores the state */
  share: () => Promise<string | undefined>
}>()
const emit = defineEmits<{ close: [] }>()

const dialog = useTemplateRef<HTMLDialogElement>("dialog")
const kind = ref<ProblemKind>(props.diff ? "classification" : props.base.failure ? "crash" : "classification")
const expected = ref<DiffType | "">("")
const note = ref("")
const shareUrl = ref<string>()
const flash = ref("")

const report = computed(() =>
  buildReport({
    ...props.base,
    kind: kind.value,
    expectedType: expected.value || undefined,
    note: note.value,
    diff: props.diff,
    shareUrl: shareUrl.value,
    userAgent: navigator.userAgent,
  }),
)

const showsExpected = computed(() => kind.value === "classification" || kind.value === "missing")

const notify = (message: string) => {
  flash.value = message
  setTimeout(() => (flash.value = ""), 2000)
}

const copy = async (text: string, message: string) => {
  try {
    await navigator.clipboard.writeText(text)
    notify(message)
  } catch {
    notify("Copying is not allowed here")
  }
}

const close = () => {
  dialog.value?.close()
}

onMounted(async () => {
  dialog.value?.showModal()
  try {
    shareUrl.value = await props.share()
  } catch {
    shareUrl.value = undefined
  }
})
</script>

<template>
  <dialog ref="dialog" class="report-dialog" aria-labelledby="report-dialog-title" @close="emit('close')">
    <form method="dialog" class="body" @submit.prevent>
      <header>
        <h2 id="report-dialog-title">Report an issue</h2>
        <button type="button" class="close" aria-label="Close" @click="close">×</button>
      </header>

      <p v-if="diff" class="subject">
        About the diff <span :class="['badge', diff.type]">{{ diff.type }}</span> {{ diff.action }}
        <code>{{ diff.path || "/" }}</code>
        <span v-if="diff.location" class="location">at {{ diff.location }}</span>
        <span v-if="diff.description" class="description">{{ diff.description }}</span>
      </p>
      <p v-else class="subject">About the result of this comparison ({{ base.origin }}).</p>

      <fieldset>
        <legend>What is the problem?</legend>
        <label v-for="item in PROBLEM_KINDS" :key="item.id" class="kind">
          <input v-model="kind" type="radio" name="report-kind" :value="item.id" />
          {{ item.label }}
        </label>
      </fieldset>

      <label v-if="showsExpected" class="field">
        <span>Expected type <small>(optional)</small></span>
        <select v-model="expected">
          <option value="">—</option>
          <option v-for="type in DIFF_TYPES" :key="type" :value="type">{{ type }}</option>
        </select>
      </label>

      <label class="field">
        <span>Note <small>(optional)</small></span>
        <textarea v-model="note" rows="3" placeholder="What did you expect, and why?" />
      </label>

      <div class="contents">
        <p>
          The issue is prefilled with the api-smart-diff version ({{ base.version }}), the detected specification, the
          <code>apiCompare(...)</code> call, {{ diff ? "this diff and " : "" }}the diff list, both documents, your
          browser and a link that restores this comparison. Nothing is sent until you submit the issue on GitHub.
        </p>
        <p class="warning">The documents become public with the issue: remove anything private first.</p>
        <p v-if="report.omitted.documents" class="omitted" role="status">
          The documents are too large for the issue link (GitHub accepts about {{ MAX_URL_LENGTH }} characters, counted
          through its sign-in): they are left out. Use <b>Copy documents</b> and paste them into the issue, or attach
          them as files.
          <template v-if="report.omitted.link">The portal link is too long as well and is left out.</template>
        </p>
        <p v-else-if="report.omitted.diffs" class="omitted" role="status">
          The diff list is shortened in the issue; <b>Copy report as Markdown</b> has all of it.
        </p>
      </div>

      <footer>
        <span v-if="flash" class="flash" role="status">{{ flash }}</span>
        <button type="button" class="secondary" @click="copy(report.markdown, 'Report copied as Markdown')">
          Copy report as Markdown
        </button>
        <button type="button" class="secondary" @click="copy(report.documentsMarkdown, 'Documents copied')">
          Copy documents
        </button>
        <a class="primary" :href="report.url" target="_blank" rel="noopener noreferrer" @click="close">
          Open GitHub issue ↗
        </a>
      </footer>
    </form>
  </dialog>
</template>

<style scoped>
.report-dialog {
  position: fixed;
  inset: 0;
  margin: auto;
  width: min(640px, calc(100vw - 32px));
  height: fit-content;
  max-height: calc(100vh - 48px);
  padding: 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  box-shadow: var(--vp-shadow-4);
}

.report-dialog::backdrop {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
}

.body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px 18px;
  font-size: 14px;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

h2 {
  margin: 0;
  padding: 0;
  border: none;
  font-size: 18px;
  font-weight: 600;
}

.close {
  font-size: 22px;
  line-height: 1;
  color: var(--vp-c-text-2);
}

.subject {
  margin: 0;
  color: var(--vp-c-text-2);
  line-height: 1.6;
}

.subject code {
  font-size: 12px;
  word-break: break-all;
}

.subject .location {
  display: block;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-text-1);
}

.subject .description {
  display: block;
  color: var(--vp-c-text-1);
}

fieldset {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 16px;
  margin: 0;
  padding: 8px 12px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
}

legend {
  padding: 0 4px;
  font-weight: 600;
}

.kind {
  display: flex;
  align-items: center;
  gap: 6px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-weight: 600;
}

.field small {
  font-weight: 400;
  color: var(--vp-c-text-3);
}

.field select,
.field textarea {
  padding: 6px 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  font: inherit;
  font-weight: 400;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-soft);
}

.field select {
  align-self: flex-start;
}

.contents p {
  margin: 0 0 6px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--vp-c-text-2);
}

.warning {
  color: var(--vp-c-warning-1) !important;
}

.omitted {
  padding: 6px 10px;
  border-radius: 6px;
  color: var(--vp-c-text-1) !important;
  background: var(--vp-c-warning-soft);
}

footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.flash {
  margin-right: auto;
  font-size: 13px;
  color: var(--vp-c-green-1);
}

.secondary,
.primary {
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
}

.secondary {
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1);
}

.secondary:hover {
  border-color: var(--vp-c-brand-1);
}

.primary {
  color: var(--vp-c-white);
  background: var(--vp-c-brand-3);
  text-decoration: none;
}

.primary:hover {
  background: var(--vp-c-brand-2);
}

.badge {
  display: inline-block;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  background: var(--asd-unclassified);
}

.badge.breaking {
  background: var(--asd-breaking);
}

.badge.risky {
  background: var(--asd-risky);
}

.badge.non-breaking {
  background: var(--asd-non-breaking);
}

.badge.deprecated {
  background: var(--asd-deprecated);
}

.badge.annotation {
  background: var(--asd-annotation);
}
</style>
