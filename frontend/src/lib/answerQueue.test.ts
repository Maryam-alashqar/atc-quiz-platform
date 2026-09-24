import { AnswerQueue, type SaveOutcome, type SaveStatus } from './answerQueue'

function setup(outcomes: SaveOutcome[] = []) {
  const calls: [string, string | null][] = []
  const statuses: SaveStatus[] = []
  let release: (() => void) | undefined
  let gate: Promise<void> | undefined
  const onClosed = vi.fn()
  const queue = new AnswerQueue({
    save: async (questionId, optionId) => {
      calls.push([questionId, optionId])
      if (gate) await gate
      return outcomes.shift() ?? { ok: true }
    },
    onStatus: (status) => statuses.push(status),
    onClosed,
    wait: () => Promise.resolve(),
  })
  return {
    queue,
    calls,
    statuses,
    onClosed,
    hold: () => {
      gate = new Promise((resolve) => (release = resolve))
    },
    release: () => {
      gate = undefined
      release?.()
    },
  }
}

describe('AnswerQueue', () => {
  it('saves each answer and reports idle when done', async () => {
    const { queue, calls, statuses } = setup()
    queue.enqueue('q1', 'a')
    queue.enqueue('q2', 'b')
    await queue.flush()
    expect(calls).toEqual([
      ['q1', 'a'],
      ['q2', 'b'],
    ])
    expect(statuses.at(-1)).toBe('idle')
  })

  it('sends only the latest choice when the student changes an answer while a save is in flight', async () => {
    const ctx = setup()
    ctx.hold()
    ctx.queue.enqueue('q1', 'a')
    ctx.queue.enqueue('q1', 'b')
    ctx.queue.enqueue('q1', 'c')
    ctx.release()
    await ctx.queue.flush()
    // First request was already in flight with "a"; the follow-up carries only the final "c".
    expect(ctx.calls).toEqual([
      ['q1', 'a'],
      ['q1', 'c'],
    ])
  })

  it('retries network failures until the answer is saved', async () => {
    const { queue, calls, statuses } = setup([{ ok: false, retry: true }, { ok: false, retry: true }])
    queue.enqueue('q1', 'a')
    await queue.flush()
    expect(calls).toHaveLength(3)
    expect(statuses).toContain('retrying')
    expect(statuses.at(-1)).toBe('idle')
    expect(queue.size).toBe(0)
  })

  it('stops and reports when the attempt is closed on the server', async () => {
    const { queue, calls, onClosed } = setup([{ ok: false, retry: false, closed: true }])
    queue.enqueue('q1', 'a')
    queue.enqueue('q2', 'b')
    await queue.flush()
    expect(calls).toEqual([['q1', 'a']])
    expect(onClosed).toHaveBeenCalledOnce()
    queue.enqueue('q3', 'c')
    await queue.flush()
    expect(calls).toHaveLength(1)
  })

  it('reports a rejected answer as failed without blocking the rest', async () => {
    const { queue, calls, statuses } = setup([{ ok: false, retry: false, closed: false }])
    queue.enqueue('q1', 'bad')
    queue.enqueue('q2', 'b')
    await queue.flush()
    expect(calls).toHaveLength(2)
    expect(statuses.at(-1)).toBe('failed')
  })

  it('resolves flush immediately when nothing is pending', async () => {
    const { queue } = setup()
    await expect(queue.flush()).resolves.toBeUndefined()
  })
})
