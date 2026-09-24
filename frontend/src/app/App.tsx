import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { I18nProvider } from '../i18n/I18nProvider'
import { queryClient } from './queryClient'
import { router } from './router'

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <RouterProvider router={router} />
      </I18nProvider>
    </QueryClientProvider>
  )
}
