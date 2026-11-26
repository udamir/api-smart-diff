<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue"

import type { Diff, DiffType } from "../../../../src"
import { DIFF_TYPE_HINTS, countByType } from "../diff"
import type { DiffLocation } from "../location"
import type { SourceLine } from "../proto"
import {
  type SortKey,
  type SortState,
  nextSort,
  presentTypes,
  resultView,
  sortSummary,
  staleHidden,
  viewDiffs,
} from "../results"
import DiffTable from "./DiffTable.vue"
import DiffsYaml from "./DiffsYaml.vue"

// the result of a comparison (examples and demo): one toolbar (the chips of the types present and the search on the
// left, Table | YAML on the right) above the table or the raw YAML; the filter, the search and the sort of the table
// apply to both views (see results.ts)
const props = withDefaults(
  defineProps<{
    diffs: readonly Diff[]
    /** the API location of every diff (same order as `diffs`, see location.ts) */
    locations?: readonly DiffLocation[]
    /** the engine of the comparison: selects the location columns */
    engine?: string
    compact?: boolean
    reportable?: boolean
    /** accessible label of the YAML view */
    label: string
    yamlHeight?: string
    /** `.proto` input: the source lines of the diffs (same order as `diffs`); a row with one can be selected */
    sourceLines?: readonly (SourceLine | undefined)[]
    /** index (in `diffs`) of the selected diff */
    selected?: number
  }>(),
  { compact: false, reportable: false, yamlHeight: "420px", sourceLines: undefined, selected: undefined },
)
const emit = defineEmits<{ report: [diff: Diff, location?: DiffLocation]; select: [index: number] }>()

const view = defineModel<"table" | "yaml">("view", { default: "table" })

const hidden = reactive<Partial<Record<DiffType, boolean>>>({})
const query = ref("")
const sort = ref<SortState>()

const counts = computed(() => countByType(props.diffs))
// only the types the result has get a chip; a type that no longer occurs is shown again (no invisible filter)
const present = computed(() => presentTypes(counts.value))
watch(counts, (current) => {
  for (const type of staleHidden(hidden, current)) {
    delete hidden[type]
  }
})
const rows = computed(() =>
  resultView(props.diffs, {
    locations: props.locations,
    engine: props.engine,
    hidden,
    query: query.value,
    sort: sort.value,
  }),
)
const shown = computed(() => viewDiffs(rows.value))
const located = computed(() => props.locations?.length === props.diffs.length)

const toggle = (type: DiffType) => (hidden[type] = !hidden[type])
const onSort = (key: SortKey) => (sort.value = nextSort(sort.value, key))
</script>

<template>
  <div class="diff-results">
    <div class="toolbar">
      <div v-if="present.length" class="summary" role="group" aria-label="Diffs by type">
        <button
          v-for="type in present"
          :key="type"
          type="button"
          :class="['chip', { off: hidden[type] }]"
          :title="`${type}: ${DIFF_TYPE_HINTS[type]} (click to show / hide, in the table and the YAML)`"
          :aria-pressed="!hidden[type]"
          @click="toggle(type)"
        >
          <span :class="['badge', type]">{{ type }}</span>
          <b>{{ counts[type] }}</b>
        </button>
      </div>
      <input
        v-if="diffs.length > 1"
        v-model="query"
        class="query"
        type="search"
        :placeholder="
          engine === 'protoapi' ? 'Filter: rpc, declaration, path, text…' : 'Filter: endpoint, method, path, text…'
        "
        aria-label="Filter the diffs by location, path or description"
        title="Filters the table and the YAML view"
      />
      <div class="views" role="tablist" aria-label="Result view">
        <button
          role="tab"
          type="button"
          :aria-selected="view === 'table'"
          :class="{ active: view === 'table' }"
          @click="view = 'table'"
        >
          Table
        </button>
        <button
          role="tab"
          type="button"
          :aria-selected="view === 'yaml'"
          :class="{ active: view === 'yaml' }"
          :title="`The diffs shown in the table as YAML (same filter${sort ? ' and order' : ''})`"
          @click="view = 'yaml'"
        >
          YAML
        </button>
      </div>
    </div>
    <DiffTable
      v-if="view === 'table'"
      :rows="rows"
      :total="diffs.length"
      :engine="engine"
      :located="located"
      :sort="sort"
      :compact="compact"
      :reportable="reportable"
      :source-lines="sourceLines"
      :selected="selected"
      @sort="onSort"
      @select="(index) => emit('select', index)"
      @report="(diff, location) => emit('report', diff, location)"
    />
    <DiffsYaml
      v-else
      :diffs="shown"
      :total="diffs.length"
      :order="sortSummary(sort, engine)"
      :label="label"
      :height="yamlHeight"
    />
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  padding: 10px 14px;
}

.summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px 2px 2px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  font-size: 12px;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  transition: opacity 0.2s;
}

.chip.off {
  opacity: 0.45;
}

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

.query {
  flex: 1 1 180px;
  min-width: 160px;
  max-width: 360px;
  padding: 2px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  font-size: 12px;
  line-height: 20px;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
}

.views {
  display: inline-flex;
  flex: none;
  margin-left: auto;
  border: 1px solid var(--vp-c-divider);
  border-radius: 7px;
  overflow: hidden;
}

.views [role="tab"] {
  padding: 3px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--vp-c-text-2);
}

.views [role="tab"] + [role="tab"] {
  border-left: 1px solid var(--vp-c-divider);
}

.views [role="tab"]:hover {
  color: var(--vp-c-text-1);
}

.views [role="tab"].active {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-bg);
}

.toolbar + .diffs-yaml {
  border-top: 1px solid var(--vp-c-divider);
}
</style>
