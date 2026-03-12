interface LastRefreshedProps {
  timestamp?: string
}

export function LastRefreshed({ timestamp }: LastRefreshedProps) {
  if (!timestamp) {
    return <p className='text-muted-foreground text-sm'>Last refreshed: --</p>
  }

  const formatted = new Date(timestamp).toLocaleString()
  return (
    <p className='text-muted-foreground text-sm'>Last refreshed: {formatted}</p>
  )
}
