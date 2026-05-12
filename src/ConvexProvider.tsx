import { type ReactNode } from 'react'
import { ConvexProvider as BaseConvexProvider, ConvexReactClient } from 'convex/react'

const convexUrl = import.meta.env.VITE_CONVEX_URL
const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null

type AppConvexProviderProps = {
  children: ReactNode
}

export function AppConvexProvider({ children }: AppConvexProviderProps) {
  if (!convexClient) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <h1>Convex is not configured</h1>
        <p>Add <code>VITE_CONVEX_URL</code> to <code>.env.local</code>, then restart the dev server.</p>
      </main>
    )
  }

  return <BaseConvexProvider client={convexClient}>{children}</BaseConvexProvider>
}
