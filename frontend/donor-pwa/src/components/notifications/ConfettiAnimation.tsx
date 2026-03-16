/**
 * ConfettiAnimation (T062) — celebratory confetti overlay
 *
 * Uses canvas-confetti to trigger a burst when `trigger` is true.
 * Respects prefers-reduced-motion.
 */
import { useEffect } from 'react'
import confetti from 'canvas-confetti'

interface ConfettiAnimationProps {
  trigger?: boolean
}

export function ConfettiAnimation({ trigger = true }: ConfettiAnimationProps) {
  useEffect(() => {
    if (!trigger) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    })

    const timer = setTimeout(() => {
      confetti.reset()
    }, 2000)

    return () => {
      clearTimeout(timer)
      confetti.reset()
    }
  }, [trigger])

  return null
}
