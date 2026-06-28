import type { ReactNode } from 'react'
import { AiEnabledContext, useAiEnabledState } from '../hooks/useAiEnabled'

export function AiEnabledProvider({ children }: { children: ReactNode }) {
  const value = useAiEnabledState()
  return <AiEnabledContext.Provider value={value}>{children}</AiEnabledContext.Provider>
}
