/**
 * SearchBar Component
 * Search input with debouncing and TanStack Query integration
 *
 * T074: Debounced input (300ms)
 * T075: TanStack Query hook with min 2 character validation
 * T081: Loading spinner
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useNpoContext } from '@/hooks/use-npo-context'
import { searchService } from '@/services/search'
import { useQuery } from '@tanstack/react-query'
import { Loader2, SearchIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SearchResults } from './SearchResults'

interface SearchBarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SearchBar({ open, onOpenChange }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const { selectedNpoId } = useNpoContext()

  // T074: Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  // Handle dialog state changes
  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen)
    // Reset query when closing
    if (!newOpen) {
      setQuery('')
      setDebouncedQuery('')
    }
  }

  // T075: Min 2 character validation
  const shouldSearch = debouncedQuery.length >= 2

  // TanStack Query for search
  const { data: results, isLoading } = useQuery({
    queryKey: ['search', debouncedQuery, selectedNpoId],
    queryFn: () =>
      searchService.search({
        query: debouncedQuery,
        npo_id: selectedNpoId,
        limit: 10,
      }),
    enabled: shouldSearch && open,
    staleTime: 30000, // 30 seconds
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle className='sr-only'>Search</DialogTitle>
        </DialogHeader>
        <DialogDescription className='sr-only'>
          Search for users, organizations, events, and auction items
        </DialogDescription>

        <div className='relative'>
          <SearchIcon className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
          {/* T081: Loading spinner */}
          {isLoading && (
            <Loader2 className='absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground' />
          )}
          <Input
            type='text'
            placeholder='Search users, organizations, events, auction items...'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className='pl-10 pr-10'
            autoFocus
          />
        </div>

        {query.length > 0 && query.length < 2 && (
          <p className='text-muted-foreground text-sm px-2'>
            Type at least 2 characters to search
          </p>
        )}

        {shouldSearch && <SearchResults results={results || null} isLoading={isLoading} />}
      </DialogContent>
    </Dialog>
  )
}
