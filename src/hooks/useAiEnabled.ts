import { createContext, useContext, useState } from 'react'
import { getAiEnabled, setAiEnabled } from '../lib/aiPreference'

interface AiEnabledContextValue {
  aiEnabled: boolean
  setAiEnabled: (enabled: boolean) => void
}

export const AiEnabledContext = createContext<AiEnabledContextValue>({
  aiEnabled: true,
  setAiEnabled: () => {},
})

export function useAiEnabled(): boolean {
  return useContext(AiEnabledContext).aiEnabled
}

export function useAiEnabledControls(): AiEnabledContextValue {
  return useContext(AiEnabledContext)
}

export function useAiEnabledState(): AiEnabledContextValue {
  const [aiEnabled, setEnabled] = useState(() => getAiEnabled())

  const toggle = (enabled: boolean) => {
    setAiEnabled(enabled)
    setEnabled(enabled)
  }

  return { aiEnabled, setAiEnabled: toggle }
}
