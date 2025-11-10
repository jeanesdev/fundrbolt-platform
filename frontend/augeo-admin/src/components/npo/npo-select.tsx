/**
 * NPOSelect Component
 * Reusable component for selecting an NPO from a list
 * Fetches NPOs and displays them in a searchable select dropdown
 */

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import npoService from '@/services/npo-service'
import type { NPO } from '@/types/npo'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

interface NPOSelectProps {
  value?: string
  onValueChange: (value: string) => void
  label?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  error?: string
}

export function NPOSelect({
  value,
  onValueChange,
  label = 'Organization',
  placeholder = 'Select an organization',
  disabled = false,
  required = false,
  error,
}: NPOSelectProps) {
  const [npos, setNpos] = useState<NPO[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    async function loadNPOs() {
      try {
        setIsLoading(true)
        setLoadError(null)
        // Fetch approved NPOs only
        const response = await npoService.listNPOs({
          status: 'approved',
          page: 1,
          page_size: 100, // Get all approved NPOs
        })
        setNpos(response.items)
      } catch (_err) {
        setLoadError('Failed to load organizations')
      } finally {
        setIsLoading(false)
      }
    }

    loadNPOs()
  }, [])

  return (
    <div className="space-y-2">
      {label && (
        <Label htmlFor="npo-select">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}

      <Select value={value} onValueChange={onValueChange} disabled={disabled || isLoading}>
        <SelectTrigger id="npo-select" className={error ? 'border-destructive' : ''}>
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-muted-foreground">Loading organizations...</span>
            </div>
          ) : (
            <SelectValue placeholder={placeholder} />
          )}
        </SelectTrigger>
        <SelectContent>
          {npos.length === 0 && !isLoading && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No organizations found
            </div>
          )}
          {npos.map((npo) => (
            <SelectItem key={npo.id} value={npo.id}>
              <div className="flex flex-col">
                <span className="font-medium">{npo.name}</span>
                {npo.tagline && (
                  <span className="text-xs text-muted-foreground">{npo.tagline}</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {loadError && (
        <p className="text-sm text-destructive">{loadError}</p>
      )}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
