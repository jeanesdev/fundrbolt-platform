export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatCurrencyCompact(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''

  if (abs >= 1_000_000_000) {
    const scaled = abs / 1_000_000_000
    const decimals = scaled >= 10 ? 0 : 1
    return `${sign}$${scaled.toFixed(decimals)}b`
  }

  if (abs >= 1_000_000) {
    const scaled = abs / 1_000_000
    const decimals = scaled >= 10 ? 0 : 1
    return `${sign}$${scaled.toFixed(decimals)}m`
  }

  if (abs >= 1_000) {
    const scaled = abs / 1_000
    const decimals = scaled >= 10 ? 0 : 1
    return `${sign}$${scaled.toFixed(decimals)}k`
  }

  return `${sign}$${Math.round(abs).toLocaleString('en-US')}`
}

export function formatPercent(value: number, maximumFractionDigits = 1): string {
  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits,
  }).format(value)}%`
}

export function titleFromKey(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function formatSourceLabel(source: string): string {
  const aliases: Record<string, string> = {
    silent_auction: 'Silent Auction',
    paddle_raise: 'Paddle Raise',
    fees_other: 'Fees & Other',
  }

  return aliases[source] ?? titleFromKey(source)
}
