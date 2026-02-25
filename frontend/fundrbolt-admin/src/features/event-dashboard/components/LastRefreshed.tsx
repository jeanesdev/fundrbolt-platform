interface LastRefreshedProps {
  timestamp?: string
}

export function LastRefreshed({ timestamp }: LastRefreshedProps) {
  if (!timestamp) {
    return <p className='text-sm text-muted-foreground'>Last refreshed: --</p>
  }

  const formatted = new Date(timestamp).toLocaleString()
  return <p className='text-sm text-muted-foreground'>Last refreshed: {formatted}</p>
}
