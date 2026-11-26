<script setup lang="ts">
import type { Compartment } from "@codemirror/state"
import type { EditorView } from "@codemirror/view"
import { useData } from "vitepress"
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from "vue"

import type { Language } from "../diff"

const props = defineProps<{
  modelValue: string
  language: Language
  readonly?: boolean
  label: string
  /** zero-based lines to highlight and scroll to (the source of a selected `.proto` diff) */
  highlight?: { from: number; to: number }
}>()
const emit = defineEmits<{ "update:modelValue": [value: string] }>()

const { isDark } = useData()
const host = useTemplateRef<HTMLDivElement>("host")
const view = shallowRef<EditorView>()

let reconfigure: ((language: Language, dark: boolean, readonly: boolean) => void) | undefined
let showHighlight: ((lines: { from: number; to: number } | undefined) => void) | undefined

onMounted(async () => {
  // CodeMirror touches the DOM, so it is loaded in the browser only
  const [
    { basicSetup },
    { EditorState, Compartment, StateEffect, StateField, RangeSetBuilder },
    { Decoration, EditorView, keymap },
    language,
    theme,
    json,
    yaml,
    commands,
    protobuf,
  ] = await Promise.all([
    import("codemirror"),
    import("@codemirror/state"),
    import("@codemirror/view"),
    import("@codemirror/language"),
    import("@codemirror/theme-one-dark"),
    import("@codemirror/lang-json"),
    import("@codemirror/lang-yaml"),
    import("@codemirror/commands"),
    import("@codemirror/legacy-modes/mode/protobuf"),
  ])

  const languages: Record<Language, () => unknown> = {
    json: () => json.json(),
    yaml: () => yaml.yaml(),
    proto: () => language.StreamLanguage.define(protobuf.protobuf),
    text: () => [],
  }

  // highlighted source lines (a selected `.proto` diff)
  const setHighlight = StateEffect.define<{ from: number; to: number } | undefined>()
  const lineMark = Decoration.line({ class: "cm-source-line" })
  const highlightField = StateField.define({
    create: () => Decoration.none,
    update: (decorations, transaction) => {
      let next = decorations.map(transaction.changes)
      for (const effect of transaction.effects) {
        if (effect.is(setHighlight)) {
          const builder = new RangeSetBuilder<typeof lineMark>()
          const lines = effect.value
          if (lines) {
            const last = Math.min(lines.to, transaction.state.doc.lines - 1)
            for (let line = Math.max(0, lines.from); line <= last; line++) {
              const { from } = transaction.state.doc.line(line + 1)
              builder.add(from, from, lineMark)
            }
          }
          next = builder.finish()
        }
      }
      return next
    },
    provide: (field) => EditorView.decorations.from(field),
  })

  const base = EditorView.theme({
    "&": { height: "100%", fontSize: "13px", backgroundColor: "transparent" },
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": { fontFamily: "var(--vp-font-family-mono)", lineHeight: "1.6" },
    ".cm-gutters": { backgroundColor: "transparent", border: "none", color: "var(--vp-c-text-3)" },
    ".cm-activeLineGutter, .cm-activeLine": { backgroundColor: "var(--vp-c-default-soft)" },
    ".cm-source-line": { backgroundColor: "var(--vp-c-yellow-soft)", boxShadow: "inset 3px 0 0 var(--vp-c-yellow-1)" },
  })
  const dark = [
    language.syntaxHighlighting(theme.oneDarkHighlightStyle),
    EditorView.theme(
      {
        "&": { color: "#abb2bf" },
        ".cm-content": { caretColor: "#e5e7eb" },
        "&.cm-focused .cm-cursor": { borderLeftColor: "#e5e7eb" },
        "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground": {
          backgroundColor: "#3e4451",
        },
      },
      { dark: true },
    ),
  ]

  const compartments: Compartment[] = [new Compartment(), new Compartment(), new Compartment()]
  const [languageSlot, themeSlot, readonlySlot] = compartments
  const readonlyExtensions = (readonly: boolean) => [
    EditorState.readOnly.of(readonly),
    EditorView.editable.of(!readonly),
  ]

  view.value = new EditorView({
    parent: host.value!,
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        basicSetup,
        keymap.of([commands.indentWithTab]),
        base,
        highlightField,
        EditorView.contentAttributes.of({ "aria-label": props.label }),
        languageSlot.of(languages[props.language]() as never),
        themeSlot.of(isDark.value ? dark : []),
        readonlySlot.of(readonlyExtensions(!!props.readonly)),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            emit("update:modelValue", update.state.doc.toString())
          }
        }),
      ],
    }),
  })

  showHighlight = (lines) => {
    const editor = view.value
    if (!editor) {
      return
    }
    const effects: unknown[] = [setHighlight.of(lines)]
    if (lines && lines.from < editor.state.doc.lines) {
      effects.push(EditorView.scrollIntoView(editor.state.doc.line(lines.from + 1).from, { y: "center" }))
    }
    editor.dispatch({ effects: effects as never })
  }
  showHighlight(props.highlight)

  reconfigure = (lang, isDarkTheme, readonly) => {
    view.value?.dispatch({
      effects: [
        languageSlot.reconfigure(languages[lang]() as never),
        themeSlot.reconfigure(isDarkTheme ? dark : []),
        readonlySlot.reconfigure(readonlyExtensions(readonly)),
      ],
    })
  }
})

watch(
  () => props.modelValue,
  (value) => {
    const current = view.value?.state.doc.toString()
    if (view.value && value !== current) {
      view.value.dispatch({ changes: { from: 0, to: view.value.state.doc.length, insert: value } })
    }
  },
)

watch([() => props.language, isDark, () => props.readonly], ([lang, dark, readonly]) =>
  reconfigure?.(lang, dark, !!readonly),
)

watch(
  () => props.highlight,
  (lines) => showHighlight?.(lines),
)

onBeforeUnmount(() => view.value?.destroy())
</script>

<template>
  <div ref="host" class="code-editor" />
</template>

<style scoped>
.code-editor {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.code-editor :deep(.cm-editor) {
  height: 100%;
}
</style>
