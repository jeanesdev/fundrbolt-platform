import { useEffect } from 'react'

import { sanitizeInputValueByType, sanitizeTextInput } from '../utils/sanitization'

function sanitizeEventTarget(target: EventTarget | null): void {
  if (typeof window === 'undefined') {
    return
  }

  if (target instanceof HTMLTextAreaElement) {
    const sanitizedValue = sanitizeTextInput(target.value)

    if (sanitizedValue !== target.value) {
      target.value = sanitizedValue
    }

    return
  }

  if (target instanceof HTMLInputElement) {
    const sanitizedValue = sanitizeInputValueByType(target.value, target.type)

    if (sanitizedValue !== target.value) {
      target.value = sanitizedValue
    }
  }
}

export function useGlobalInputSanitizer(): void {
  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const handleInput = (event: Event) => {
      if (event instanceof InputEvent && event.isComposing) {
        return
      }

      sanitizeEventTarget(event.target)
    }

    document.addEventListener('input', handleInput, true)
    document.addEventListener('change', handleInput, true)

    return () => {
      document.removeEventListener('input', handleInput, true)
      document.removeEventListener('change', handleInput, true)
    }
  }, [])
}
