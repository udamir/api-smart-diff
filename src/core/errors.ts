/** Thrown by `apiCompare` when the documents are not a supported specification (or two different ones). */
export class UnsupportedSpecError extends Error {
  constructor(
    message: string,
    public readonly before?: string,
    public readonly after?: string,
  ) {
    super(message)
    this.name = "UnsupportedSpecError"
  }
}
