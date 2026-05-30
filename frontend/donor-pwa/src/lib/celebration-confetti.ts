import confetti from 'canvas-confetti'

let confettiCanvas: HTMLCanvasElement | null = null
let confettiRunner: ReturnType<typeof confetti.create> | null = null
let lastTriggeredAt = 0

function ensureConfettiRunner() {
  if (confettiRunner) {
    return confettiRunner
  }

  confettiCanvas = document.createElement('canvas')
  confettiCanvas.setAttribute('aria-hidden', 'true')
  confettiCanvas.style.cssText =
    'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9998;'
  document.body.appendChild(confettiCanvas)

  confettiRunner = confetti.create(confettiCanvas, {
    resize: true,
    useWorker: true,
    disableForReducedMotion: true,
  })

  return confettiRunner
}

export function triggerCelebrationConfetti() {
  if (typeof window === 'undefined') {
    return
  }

  const now = Date.now()
  if (now - lastTriggeredAt < 1200) {
    return
  }
  lastTriggeredAt = now

  const runConfetti = ensureConfettiRunner()

  runConfetti({
    particleCount: 110,
    spread: 100,
    startVelocity: 45,
    scalar: 0.95,
    origin: { x: 0.1, y: 0.25 },
  })

  runConfetti({
    particleCount: 110,
    spread: 100,
    startVelocity: 45,
    scalar: 0.95,
    origin: { x: 0.9, y: 0.25 },
  })

  window.setTimeout(() => {
    runConfetti({
      particleCount: 80,
      spread: 120,
      startVelocity: 35,
      scalar: 0.9,
      origin: { x: 0.5, y: 0.2 },
    })
  }, 240)
}
