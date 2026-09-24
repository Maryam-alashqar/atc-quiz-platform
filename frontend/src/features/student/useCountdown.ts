import { useEffect, useRef, useState } from 'react'
import { remainingMs } from '../../lib/time'

/** Milliseconds left until the server deadline; calls onExpire once when it reaches zero. */
export function useCountdown(deadlineIso: string, onExpire: () => void): number {
  const [remaining, setRemaining] = useState(() => remainingMs(deadlineIso))
  const expireRef = useRef(onExpire)
  useEffect(() => {
    expireRef.current = onExpire
  }, [onExpire])

  useEffect(() => {
    let fired = false
    const tick = () => {
      const left = remainingMs(deadlineIso)
      setRemaining(left)
      if (left === 0 && !fired) {
        fired = true
        expireRef.current()
      }
    }
    tick()
    // Recomputed from the clock on every tick, so a throttled background tab catches up
    // immediately instead of drifting.
    const timer = setInterval(tick, 250)
    return () => clearInterval(timer)
  }, [deadlineIso])

  return remaining
}
