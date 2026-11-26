<script setup lang="ts">
import type { Compartment } from "@codemirror/state"
import type { EditorView } from "@codemirror/view"
import { useData } from "vitepress"
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from "vue"

import type { Language } from "../diff"

const props = defineProps<{ modelValue: string; language: Language; readonly?: boolean; label: string }>()
const emit = defineEmits<{ "update:modelValue": [value: string] }>()

const { isDark } = useData()
const host = useTemplateRef<HTMLDivElement>("host")
const view = shallowRef<EditorView>()

let reconfigure: ((language: Language, dark: boolean, readonly: boolean) => void) | undefined

onMounted(async () => {
  // CodeMirror touches the DOM, so it is loaded in the browser only
  const [{ basicSetup }, { EditorState, Compartment }, { EditorView, keymap }, language, theme, json, yaml, commands] =
    await Promise.all([
      import("codemirror"),
      import("@codemirror/state"),
      import("@codemirror/view"),
      import("@codemirror/language"),
      import("@codemirror/theme-one-dark"),
      import("@codemirror/lang-json"),
      import("@codemirror/lang-yaml"),
      import("@codemirror/commands"),
    ])

  const languages: Record<Language, () => unknown> = {
    json: () => json.json(),
    yaml: () => yaml.yaml(),
    text: () => [],
  }

  const base = EditorView.theme({
    "&": { height: "100%", fontSize: "13px", backgroundColor: "transparent" },
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": { fontFamily: "var(--vp-font-family-mono)", lineHeight: "1.6" },
    ".cm-gutters": { backgroundColor: "transparent", border: "none", color: "var(--vp-c-text-3)" },
    ".cm-activeLineGutter, .cm-activeLine": { backgroundColor: "var(--vp-c-default-soft)" },
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
