/**
 * TableCapacityTooltip Component
 * Feature 014: User Story 1
 * Displays capacity warning tooltip when table is full
 */

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Info } from 'lucide-react'

interface TableCapacityTooltipProps {
  tableName: string | null
  tableNumber: number
  currentOccupancy: number
  effectiveCapacity: number
}

export function TableCapacityTooltip({
  tableName,
  tableNumber,
  currentOccupancy,
  effectiveCapacity,
}: TableCapacityTooltipProps) {
  const displayName = tableName ? `Table ${tableNumber} - ${tableName}` : `Table ${tableNumber}`

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-4 w-4 text-yellow-600" />
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-semibold">{displayName} is full</p>
          <p className="text-sm text-muted-foreground">
            {currentOccupancy}/{effectiveCapacity} seats occupied
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
