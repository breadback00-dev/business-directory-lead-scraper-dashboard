import { type ReactNode } from 'react'
import { ConvexProvider as BaseConvexProvider, ConvexReactClient } from 'convex/react'

const convexUrl = import.meta.env.VITE_CONVEX_URL
const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null

type AppConvexProviderProps = {
  children: ReactNode
}

export function AppConvexProvider({ children }: AppConvexProviderProps) {
  if (!convexClient) {
    return children
  }

  return <BaseConvexProvider client={convexClient}>{children}</BaseConvexProvider>
}
