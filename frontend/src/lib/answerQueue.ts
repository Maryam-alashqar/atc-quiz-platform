export type SaveStatus = 'idle' | 'saving' | 'retrying' | 'failed'

/** Outcome of one save attempt, as classified by the caller. */
export type SaveOutcome =
  | { ok: true }
  | { ok: false; retry: true } // network or server error: try again
  | { ok: false; retry: false; closed: boolean } // rejected; closed = the attempt no longer accepts answers

interface Options {
  save: (questionId: string, optionId: string | null) => Promise<SaveOutcome>
  onStatus: (status: SaveStatus) => void
  onClosed: () => void
  retryDelayMs?: number
  wait?: (ms: number) => Promise<void>
}

/**
 * Sends answer changes to the server one at a time.
 * - Rapid changes to the same question collapse into one request with the latest choice.
 * - Network failures are retried until they succeed, so a flaky phone connection loses nothing.
 * - flush() resolves once everything queued has been saved (or definitively rejected).
 */
export class AnswerQueue {
  private pending = new Map<string, string | null>()
  private running = false
  private closed = false
  private waiters: (() => void)[] = []
  private readonly opts: Required<Options>

  constructor(options: Options) {
    this.opts = {
      retryDelayMs: 2000,
      wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      ...options,
    }
  }

  get size(): number {
    return this.pending.size
  }

  enqueue(questionId: string, optionId: string | null): void {
    if (this.closed) return
    // Re-insert so the newest change is sent after older ones.
    this.pending.delete(questionId)
    this.pending.set(questionId, optionId)
    void this.run()
  }

  flush(): Promise<void> {
    if (!this.running && this.pending.size === 0) return Promise.resolve()
    return new Promise((resolve) => this.waiters.push(resolve))
  }

  private async run(): Promise<void> {
    if (this.running) return
    this.running = true
    let failed = false
    try {
      while (this.pending.size > 0 && !this.closed) {
        const [questionId, optionId] = this.pending.entries().next().value as [string, string | null]
        this.opts.onStatus('saving')
        const outcome = await this.opts.save(questionId, optionId)
        if (!outcome.ok && outcome.retry) {
          this.opts.onStatus('retrying')
          await this.opts.wait(this.opts.retryDelayMs)
          continue // the entry stays queued (possibly replaced by a newer choice)
        }
        // Only drop the entry if the student didn't change it while the request was in flight.
        if (this.pending.get(questionId) === optionId) this.pending.delete(questionId)
        if (!outcome.ok) {
          failed = true
          if (outcome.closed) {
            this.closed = true
            this.pending.clear()
            this.opts.onClosed()
          }
        }
      }
    } finally {
      this.running = false
      this.opts.onStatus(failed && !this.closed ? 'failed' : 'idle')
      const waiters = this.waiters.splice(0)
      waiters.forEach((resolve) => resolve())
    }
  }
}
