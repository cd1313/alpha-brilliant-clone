const KEY = 'asymptote_ai_enabled'

export function getAiEnabled(): boolean {
  return localStorage.getItem(KEY) !== 'false' // default ON
}

export function setAiEnabled(enabled: boolean): void {
  localStorage.setItem(KEY, String(enabled))
}
