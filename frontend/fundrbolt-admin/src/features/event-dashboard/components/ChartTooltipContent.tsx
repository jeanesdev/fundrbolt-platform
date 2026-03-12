import { formatCurrency } from '../utils/formatters'

interface ChartTooltipContentProps {
  label?: string
  payload?: Array<{
    name?: string
    value?: number
  }>
  seriesLabels?: Record<string, string>
}

export function ChartTooltipContent({
  label,
  payload,
  seriesLabels,
}: ChartTooltipContentProps) {
  if (!payload || payload.length === 0) {
    return null
  }

  return (
    <div className='bg-popover text-popover-foreground rounded-md border px-3 py-2 shadow-sm'>
      {label && <p className='mb-2 text-xs font-medium'>{label}</p>}
      <div className='space-y-1'>
        {payload.map((entry) => {
          const key = entry.name ?? 'value'
          const value = typeof entry.value === 'number' ? entry.value : 0
          return (
            <div
              key={key}
              className='flex items-center justify-between gap-4 text-xs'
            >
              <span>{seriesLabels?.[key] ?? key}</span>
              <span className='font-semibold'>{formatCurrency(value)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
