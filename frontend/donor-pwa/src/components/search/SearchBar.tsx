/**
 * SearchBar Component
 * Search input with debouncing and TanStack Query integration
 *
 * T074: Debounced input (300ms)
 * T075: TanStack Query hook with min 2 character validation
 * T081: Loading spinner
 */
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { searchService } from '@/services/search'
import { Loader2, SearchIcon } from 'lucide-react'
import { useNpoContext } from '@/hooks/use-npo-context'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
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
          <SearchIcon className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
          {/* T081: Loading spinner */}
          {isLoading && (
            <Loader2 className='text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin' />
          )}
          <Input
            type='text'
            placeholder='Search users, organizations, events, auction items...'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className='pr-10 pl-10'
            autoFocus
          />
        </div>

        {query.length > 0 && query.length < 2 && (
          <p className='text-muted-foreground px-2 text-sm'>
            Type at least 2 characters to search
          </p>
        )}

        {shouldSearch && (
          <SearchResults
            results={results || null}
            isLoading={isLoading}
            onClose={() => handleOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
