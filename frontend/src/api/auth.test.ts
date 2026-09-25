import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { meKey, switchSession } from './auth'
import type { User } from './types'

const admin: User = { id: 'a', username: 'admin', name: 'Nour', role: 'ADMIN', classId: null, className: null }

describe('switchSession', () => {
  it('tells components already watching the session that the user signed out', () => {
    // Regression: queryClient.clear() removed the watched query, so sign-out left the app on screen.
    const client = new QueryClient()
    client.setQueryData(meKey, admin)
    const seen: unknown[] = []
    const observer = new QueryObserver(client, { queryKey: meKey, queryFn: () => admin, enabled: false })
    const unsubscribe = observer.subscribe((result) => seen.push(result.data))
    switchSession(client, null)
    expect(seen.at(-1)).toBeNull()
    unsubscribe()
  })

  it('drops the previous user’s cached data but keeps the session', () => {
    const client = new QueryClient()
    client.setQueryData(['admin', 'overview'], { secret: true })
    client.setQueryData(['student', 'history'], [])
    switchSession(client, admin)
    expect(client.getQueryData(['admin', 'overview'])).toBeUndefined()
    expect(client.getQueryData(['student', 'history'])).toBeUndefined()
    expect(client.getQueryData(meKey)).toEqual(admin)
  })
})
