/**
 * Live comparison while typing: the editors are compared after a short pause (debounced), never in the input handler;
 * while a comparison runs, further edits are coalesced into one more run with the latest text. An input that does not
 * parse keeps the previous result, which the components show as stale. The demo compares in a web worker, so a large
 * document never blocks typing; the examples (small documents, options with functions) compare in the page.
 */
import { type Ref, type ShallowRef, computed, onScopeDispose, ref, shallowRef, watch } from "vue"

import { type Analysis, type AnalysisRequest, portableAnalysis, runAnalysis } from "./analysis"

/** Pause after the last keystroke before the editors are compared */
export const LIVE_DELAY = 250

export interface LiveRunner {
  run: (request: AnalysisRequest) => Promise<Analysis>
  dispose?: () => void
}

/** Compares in the page, in a task of its own (after the input event that scheduled it) */
export const pageRunner = (): LiveRunner => ({
  run: (request) =>
    new Promise<Analysis>((resolve, reject) => {
      setTimeout(() => runAnalysis(request).then(resolve, reject), 0)
    }),
})

interface WorkerLike {
  postMessage: (message: unknown) => void
  terminate: () => void
  onmessage: ((event: { data: WorkerReply }) => void) | null
  onerror: ((event: unknown) => void) | null
}

export interface WorkerReply {
  id: number
  analysis?: Analysis
  error?: string
}

/**
 * Compares in a module web worker (`compare.worker.ts`); falls back to the page when workers are not available, when
 * the worker fails, or for a request it cannot receive (options that are not structured-cloneable).
 */
export const workerRunner = (createWorker: () => WorkerLike): LiveRunner => {
  const fallback = pageRunner()
  let worker: WorkerLike | undefined
  try {
    worker = createWorker()
  } catch {
    return fallback
  }
  let next = 0
  const waiting = new Map<number, { request: AnalysisRequest; resolve: (analysis: Analysis) => void }>()
  const failAll = () => {
    worker?.terminate()
    worker = undefined
    for (const { request, resolve } of waiting.values()) {
      void fallback.run(request).then(resolve)
    }
    waiting.clear()
  }
  worker.onmessage = ({ data }) => {
    const entry = waiting.get(data.id)
    if (!entry) {
      return
    }
    waiting.delete(data.id)
    if (data.analysis) {
      entry.resolve(data.analysis)
    } else {
      // the worker could not analyze or send the result: the page reports the same failure itself
      void fallback.run(entry.request).then(entry.resolve)
    }
  }
  worker.onerror = failAll
  return {
    run: (request) => {
      if (!worker) {
        return fallback.run(request)
      }
      const id = ++next
      return new Promise<Analysis>((resolve) => {
        waiting.set(id, { request, resolve })
        try {
          worker!.postMessage({ id, request })
        } catch {
          waiting.delete(id)
          void fallback.run(request).then(resolve)
        }
      })
    },
    dispose: () => {
      worker?.terminate()
      worker = undefined
    },
  }
}

export interface LiveAnalysis {
  /** the last analysis with a result (or the last one of empty editors) */
  analysis: ShallowRef<Analysis | undefined>
  /** the latest analysis, also when an editor does not parse (its side labels and errors) */
  latest: ShallowRef<Analysis | undefined>
  /** parse error of the current input: the shown result belongs to an earlier input */
  inputError: Ref<string | undefined>
  /** a result is shown, but it belongs to an earlier input that parsed */
  stale: Ref<boolean>
  /** a comparison is scheduled or running */
  busy: Ref<boolean>
}

/**
 * Compares `source()` whenever it changes (debounced by `delay`, the first time at once); one comparison at a time,
 * edits made meanwhile are compared next with their latest text.
 */
export const useLiveAnalysis = (
  source: () => AnalysisRequest,
  runner: LiveRunner,
  delay = LIVE_DELAY,
): LiveAnalysis => {
  const analysis = shallowRef<Analysis>()
  const latest = shallowRef<Analysis>()
  const inputError = ref<string>()
  const busy = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  let running = false
  let again = false
  let disposed = false

  const apply = (result: Analysis) => {
    latest.value = result
    if (result.inputError) {
      inputError.value = result.inputError
      return
    }
    inputError.value = undefined
    analysis.value = result
  }

  const start = () => {
    timer = undefined
    if (running) {
      again = true
      return
    }
    running = true
    busy.value = true
    runner
      .run(source())
      .then((result) => !disposed && apply(portableAnalysis(result)))
      .catch((error: unknown) => {
        const failure = error instanceof Error ? error.message : String(error)
        if (!disposed) {
          apply({
            sides: { before: { sdl: false, label: "" }, after: { sdl: false, label: "" } },
            comparison: { errors: [], failure },
          })
        }
      })
      .finally(() => {
        running = false
        if (again) {
          again = false
          start()
        } else if (timer === undefined) {
          busy.value = false
        }
      })
  }

  watch(
    source,
    () => {
      busy.value = true
      clearTimeout(timer)
      timer = setTimeout(start, delay)
    },
    { deep: true },
  )
  start()

  onScopeDispose(() => {
    disposed = true
    clearTimeout(timer)
    runner.dispose?.()
  })

  const stale = computed(() => !!inputError.value && !!analysis.value?.comparison)
  return { analysis, latest, inputError, stale, busy }
}
