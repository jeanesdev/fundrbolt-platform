import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Search, CheckCircle, XCircle, User, Phone, Mail } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { checkinService, type GuestSearchResult } from '@/services/checkin-service'

interface EventCheckinTabProps {
  eventId: string
}

export function EventCheckinTab({ eventId }: EventCheckinTabProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<GuestSearchResult[]>([])
  const [dashboardData, setDashboardData] = useState<{
    total_registered: number
    total_checked_in: number
    checked_in: GuestSearchResult[]
  } | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [selectedGuest, setSelectedGuest] = useState<GuestSearchResult | null>(null)
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false)
  const [checkoutReason, setCheckoutReason] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const { toast } = useToast()

  // Load dashboard data on mount
  useEffect(() => {
    loadDashboard()
  }, [eventId])

  const loadDashboard = async () => {
    try {
      const data = await checkinService.getDashboard(eventId)
      setDashboardData(data)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive',
      })
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: 'Search query required',
        description: 'Please enter a name, phone number, or email to search',
        variant: 'destructive',
      })
      return
    }

    setIsSearching(true)
    try {
      const { results } = await checkinService.searchGuests(eventId, searchQuery)
      setSearchResults(results)

      if (results.length === 0) {
        toast({
          title: 'No results',
          description: 'No guests found matching your search',
        })
      }
    } catch (error) {
      toast({
        title: 'Search failed',
        description: 'Failed to search for guests',
        variant: 'destructive',
      })
    } finally {
      setIsSearching(false)
    }
  }

  const handleCheckIn = async (guest: GuestSearchResult) => {
    setIsProcessing(true)
    try {
      await checkinService.checkInGuest(eventId, guest.registration_id)
      toast({
        title: 'Check-in successful',
        description: `${guest.donor_name} has been checked in`,
      })
      // Refresh search and dashboard
      if (searchQuery) {
        handleSearch()
      }
      loadDashboard()
    } catch (error: any) {
      toast({
        title: 'Check-in failed',
        description: error.response?.data?.detail || 'Failed to check in guest',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCheckOutClick = (guest: GuestSearchResult) => {
    setSelectedGuest(guest)
    setCheckoutReason('')
    setShowCheckoutDialog(true)
  }

  const handleCheckOut = async () => {
    if (!selectedGuest || !checkoutReason.trim()) {
      toast({
        title: 'Reason required',
        description: 'Please provide a reason for checking out',
        variant: 'destructive',
      })
      return
    }

    setIsProcessing(true)
    try {
      await checkinService.checkOutGuest(eventId, selectedGuest.registration_id, checkoutReason)
      toast({
        title: 'Check-out successful',
        description: `${selectedGuest.donor_name} has been checked out`,
      })
      setShowCheckoutDialog(false)
      // Refresh search and dashboard
      if (searchQuery) {
        handleSearch()
      }
      loadDashboard()
    } catch (error: any) {
      toast({
        title: 'Check-out failed',
        description: error.response?.data?.detail || 'Failed to check out guest',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    if (status === 'checked_in') {
      return (
        <Badge className="bg-green-500">
          <CheckCircle className="h-3 w-3 mr-1" />
          Checked In
        </Badge>
      )
    }
    return (
      <Badge variant="secondary">
        <XCircle className="h-3 w-3 mr-1" />
        Not Checked In
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Summary */}
      {dashboardData && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Registered</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData.total_registered}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Checked In</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData.total_checked_in}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Remaining</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData.total_registered - dashboardData.total_checked_in}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-8"
          />
        </div>
        <Button onClick={handleSearch} disabled={isSearching}>
          {isSearching ? 'Searching...' : 'Search'}
        </Button>
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Search Results</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Seating</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {searchResults.map((guest) => (
                <TableRow key={guest.registration_id}>
                  <TableCell className="font-medium">{guest.donor_name || 'N/A'}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 text-sm">
                      {guest.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {guest.email}
                        </span>
                      )}
                      {guest.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {guest.phone}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 text-sm">
                      {guest.table_number && <span>Table: {guest.table_number}</span>}
                      {guest.bidder_number && <span>Bidder: {guest.bidder_number}</span>}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(guest.checkin_status)}</TableCell>
                  <TableCell>
                    {guest.checkin_status === 'checked_in' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCheckOutClick(guest)}
                        disabled={isProcessing}
                      >
                        Check Out
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleCheckIn(guest)}
                        disabled={isProcessing}
                      >
                        Check In
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Recently Checked In */}
      {dashboardData && dashboardData.checked_in.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Recently Checked In</h3>
          <Table>
            <TableCaption>Showing most recent check-ins</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Checked In At</TableHead>
                <TableHead>Seating</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dashboardData.checked_in.slice(0, 10).map((guest) => (
                <TableRow key={guest.registration_id}>
                  <TableCell className="font-medium">{guest.donor_name || 'N/A'}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 text-sm">
                      {guest.email && <span>{guest.email}</span>}
                      {guest.phone && <span>{guest.phone}</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {guest.checked_in_at
                      ? new Date(guest.checked_in_at).toLocaleString()
                      : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 text-sm">
                      {guest.table_number && <span>Table: {guest.table_number}</span>}
                      {guest.bidder_number && <span>Bidder: {guest.bidder_number}</span>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Check-out Dialog */}
      <Dialog open={showCheckoutDialog} onOpenChange={setShowCheckoutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check Out Guest</DialogTitle>
            <DialogDescription>
              Please provide a reason for checking out {selectedGuest?.donor_name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="reason">Reason (required)</Label>
              <Textarea
                id="reason"
                placeholder="e.g., Guest left early due to emergency"
                value={checkoutReason}
                onChange={(e) => setCheckoutReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCheckoutDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCheckOut} disabled={isProcessing || !checkoutReason.trim()}>
              {isProcessing ? 'Processing...' : 'Check Out'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
