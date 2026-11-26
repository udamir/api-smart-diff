<script setup lang="ts">
import { computed, ref, watch } from "vue"

import type { Diff } from "../../../../src"
import { pointer, previewValue } from "../diff"
import { type DiffLocation, locationColumns } from "../location"
import type { SourceLine } from "../proto"
import { type ResultRow, type SortKey, type SortState, sortHint, targetLabel } from "../results"

// the rows of the result toolbar (filtered and sorted in DiffResults, see results.ts); the sortable headers emit `sort`
const props = withDefaults(
  defineProps<{
    rows: readonly ResultRow[]
    /** the number of diffs of the comparison (before the filter) */
    total: number
    /** the engine of the comparison: selects the location columns */
    engine?: string
    /** the rows have locations (location columns instead of one pointer column) */
    located?: boolean
    sort?: SortState
    compact?: boolean
    reportable?: boolean
    /** `.proto` input: the source lines of the diffs (by the engine index of the diff); a row with one can be selected */
    sourceLines?: readonly (SourceLine | undefined)[]
    /** engine index of the selected diff */
    selected?: number
  }>(),
  { compact: false, reportable: false, located: false, sourceLines: undefined, selected: undefined },
)
const emit = defineEmits<{
  report: [diff: Diff, location?: DiffLocation]
  sort: [key: SortKey]
  select: [index: number]
}>()

const sourceOf = (index: number) => props.sourceLines?.[index]
const lineLabel = (line: SourceLine) =>
  `${line.side} ${line.file}:${line.from + 1}${line.to > line.from ? `–${line.to + 1}` : ""}`
const select = (index: number) => {
  if (sourceOf(index)) {
    emit("select", index)
  }
}

// OpenAPI: Method / Endpoint; AsyncAPI, GraphApi: their counterparts; otherwise one pointer column
const columns = computed(() => (props.located ? locationColumns(props.engine) : undefined))

// a large change set renders its first rows only (rendering thousands of rows would block typing in the editors)
const ROW_LIMIT = 300

const showAll = ref(false)
watch(
  () => props.total,
  () => (showAll.value = false),
)
const visible = computed(() => (showAll.value ? props.rows : props.rows.slice(0, ROW_LIMIT)))

const ariaSort = (key: SortKey) =>
  props.sort?.key === key ? (props.sort.direction === "asc" ? "ascending" : "descending") : undefined
const arrow = (key: SortKey) => (props.sort?.key === key ? (props.sort.direction === "asc" ? "▲" : "▼") : "↕")
</script>

<template>
  <div class="diff-table">
    <p v-if="!total" class="empty-note">No differences.</p>
    <p v-else-if="!rows.length" class="empty-note">No diffs match the filter.</p>
    <div v-else class="scroll">
      <table>
        <thead>
          <tr>
            <th :aria-sort="ariaSort('type')">
              <button
                type="button"
                :class="['sort', { active: sort?.key === 'type' }]"
                :title="sortHint('type', engine, sort)"
                @click="emit('sort', 'type')"
              >
                Type <span class="arrow" aria-hidden="true">{{ arrow("type") }}</span>
              </button>
            </th>
            <template v-if="columns">
              <th
                v-for="column in columns"
                :key="column.key"
                :aria-sort="column.key === 'target' ? ariaSort('target') : undefined"
              >
                <button
                  v-if="column.key === 'target'"
                  type="button"
                  :class="['sort', { active: sort?.key === 'target' }]"
                  :title="sortHint('target', engine, sort)"
                  @click="emit('sort', 'target')"
                >
                  {{ column.label }} <span class="arrow" aria-hidden="true">{{ arrow("target") }}</span>
                </button>
                <template v-else>{{ column.label }}</template>
              </th>
            </template>
            <th v-else :aria-sort="ariaSort('target')">
              <button
                type="button"
                :class="['sort', { active: sort?.key === 'target' }]"
                :title="sortHint('target', engine, sort)"
                @click="emit('sort', 'target')"
              >
                {{ targetLabel(engine) }} <span class="arrow" aria-hidden="true">{{ arrow("target") }}</span>
              </button>
            </th>
            <th>Description</th>
            <th v-if="!compact">Path</th>
            <th v-if="reportable"><span class="sr-only">Report</span></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="{ diff, location, index } in visible"
            :key="index"
            :class="{ locatable: !!sourceOf(index), selected: selected !== undefined && index === selected }"
            :title="sourceOf(index) ? 'Click to highlight the source line' : undefined"
            @click="select(index)"
          >
            <td><span :class="['badge', diff.type]">{{ diff.type }}</span></td>
            <template v-if="columns">
              <td v-for="column in columns" :key="column.key" :class="column.key" :title="location?.text">
                {{ location?.[column.key] }}
                <template v-if="column.key === 'target'">
                  <div v-if="location?.via" class="via">via {{ location.via }}</div>
                  <ul v-if="location?.usages?.length" class="usages" aria-label="Usages of the component">
                    <li v-for="usage in location.usages" :key="usage">used in {{ usage }}</li>
                  </ul>
                </template>
              </td>
            </template>
            <td v-else class="target path">{{ location?.text ?? (pointer(diff.path) || "/") }}</td>
            <td class="description">
              {{ diff.description }}
              <div v-if="compact && columns" class="path">{{ pointer(diff.path) }}</div>
              <div v-if="compact && sourceOf(index)" class="source">{{ lineLabel(sourceOf(index)!) }}</div>
              <div v-if="!compact && (diff.before !== undefined || diff.after !== undefined)" class="values">
                <span v-if="diff.before !== undefined" class="before">− {{ previewValue(diff.before) }}</span>
                <span v-if="diff.after !== undefined" class="after">+ {{ previewValue(diff.after) }}</span>
              </div>
            </td>
            <td v-if="!compact" class="path">
              {{ pointer(diff.path) }}
              <div v-if="diff.origin" class="origin" title="declaration path of the value (inside a $ref target)">
                origin {{ pointer(diff.origin.before) }}
              </div>
              <div v-if="sourceOf(index)" class="source">{{ lineLabel(sourceOf(index)!) }}</div>
            </td>
            <td v-if="reportable" class="report">
              <button
                type="button"
                class="report-row"
                title="Report: this diff is wrong"
                :aria-label="`Report: this diff is wrong (${diff.type} ${diff.action} ${pointer(diff.path)})`"
                @click.stop="emit('report', diff, location)"
              >
                ⚑
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="rows.length > visible.length" class="more">
        Showing {{ visible.length }} of {{ rows.length }} diffs.
        <button type="button" class="link" @click="showAll = true">Show all</button>
      </p>
    </div>
  </div>
</template>

<style scoped>
.badge {
  display: inline-block;
  min-width: 88px;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
  white-space: nowrap;
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

.empty-note {
  margin: 0 !important;
  padding: 4px 14px 14px;
  color: var(--vp-c-text-2);
  font-size: 14px;
}

.scroll {
  overflow-x: auto;
}

table {
  display: table;
  width: 100%;
  margin: 0 !important;
  border-collapse: collapse;
  font-size: 13px;
}

th,
td {
  padding: 6px 10px !important;
  border: none !important;
  border-top: 1px solid var(--vp-c-divider) !important;
  text-align: left;
  vertical-align: top;
  background: transparent !important;
}

th {
  font-size: 12px;
  white-space: nowrap;
  font-weight: 600;
  color: var(--vp-c-text-2);
}

tr {
  background: transparent !important;
  border: none !important;
}

.via,
.usages {
  font-size: 11px;
  font-family: var(--vp-font-family-base);
  color: var(--vp-c-text-3);
}

.method {
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  color: var(--vp-c-text-1);
}

.target {
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  min-width: 120px;
  word-break: break-word;
}

.part {
  min-width: 140px;
  color: var(--vp-c-text-1);
}

.usages {
  margin: 2px 0 0 !important;
  padding: 0 !important;
  list-style: none !important;
  line-height: 1.5;
}

.usages li {
  margin: 0 !important;
}

.sort {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  font: inherit;
  color: inherit;
}

.sort:hover,
.sort.active {
  color: var(--vp-c-brand-1);
}

.sort .arrow {
  display: inline-block;
  width: 10px;
  font-size: 10px;
  opacity: 0.5;
}

.sort.active .arrow {
  opacity: 1;
}

.description {
  min-width: 260px;
  line-height: 1.5;
}

.path {
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-text-2);
  word-break: break-all;
}

.report {
  width: 1%;
  text-align: right;
}

.report-row {
  padding: 0 4px;
  border-radius: 4px;
  font-size: 14px;
  line-height: 20px;
  color: var(--vp-c-text-3);
  opacity: 0.6;
  transition:
    color 0.2s,
    opacity 0.2s;
}

tr:hover .report-row,
.report-row:focus-visible {
  opacity: 1;
}

.report-row:hover {
  color: var(--vp-c-danger-1);
}

.more {
  margin: 0 !important;
  padding: 8px 14px;
  border-top: 1px solid var(--vp-c-divider);
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.more .link {
  margin-left: 8px;
  font-weight: 500;
  color: var(--vp-c-brand-1);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.origin {
  margin-top: 2px;
  color: var(--vp-c-text-3);
}

.source {
  margin-top: 2px;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-brand-1);
}

tr.locatable {
  cursor: pointer;
}

tr.locatable:hover td {
  background: var(--vp-c-default-soft) !important;
}

tr.selected td {
  background: var(--vp-c-yellow-soft) !important;
}

.values {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 12px;
  margin-top: 2px;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
}

.values .before {
  color: var(--vp-c-danger-1);
}

.values .after {
  color: var(--vp-c-green-1);
}
</style>
