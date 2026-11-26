/**
 * The demo's comparison worker: parses the editors, compares them and serializes the merged document off the main
 * thread, so typing into a large document never waits for `apiCompare` (see `live.ts`).
 */
import { type AnalysisRequest, portableAnalysis, runAnalysis } from "./analysis"
import type { WorkerReply } from "./live"

// the worker global (the project's TypeScript configuration has no DOM / WebWorker library)
const scope = globalThis as unknown as {
  onmessage: ((event: { data: { id: number; request: AnalysisRequest } }) => void) | null
  postMessage: (message: WorkerReply) => void
}

scope.onmessage = async ({ data: { id, request } }) => {
  try {
    scope.postMessage({ id, analysis: portableAnalysis(await runAnalysis(request)) })
  } catch (error) {
    // an analysis error, or a result that is not structured-cloneable: the page compares the request itself
    scope.postMessage({ id, error: error instanceof Error ? error.message : String(error) })
  }
}
