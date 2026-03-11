/**
 * AuctionItemDetailPage
 * Shows auction item details (description, pricing, additional info).
 * Wrapped in AuctionItemDetailLayout which provides header, status, sub-nav, and dialogs.
 */
import { ExternalLink } from 'lucide-react'
import { useAuctionItemStore } from '@/stores/auctionItemStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AuctionItemDetailLayout } from './AuctionItemDetailLayout'

const formatCurrency = (amount: number | null): string => {
  if (!amount) return 'N/A'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export function AuctionItemDetailPage() {
  const { selectedItem } = useAuctionItemStore()

  // Layout handles loading state and data fetching
  return (
    <AuctionItemDetailLayout>
      {selectedItem && (
        <div className='space-y-6'>
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className='whitespace-pre-wrap'>{selectedItem.description}</p>
            </CardContent>
          </Card>

          {/* Pricing Information */}
          <Card>
            <CardHeader>
              <CardTitle>Pricing Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3'>
                <div>
                  <p className='text-muted-foreground text-sm'>Starting Bid</p>
                  <p className='text-lg font-semibold'>
                    {formatCurrency(selectedItem.starting_bid)}
                  </p>
                </div>

                {selectedItem.donor_value && (
                  <div>
                    <p className='text-muted-foreground text-sm'>Donor Value</p>
                    <p className='text-lg font-semibold'>
                      {formatCurrency(selectedItem.donor_value)}
                    </p>
                  </div>
                )}

                {selectedItem.cost && (
                  <div>
                    <p className='text-muted-foreground text-sm'>Cost to NPO</p>
                    <p className='text-lg font-semibold'>
                      {formatCurrency(selectedItem.cost)}
                    </p>
                  </div>
                )}

                {selectedItem.buy_now_price && selectedItem.buy_now_enabled && (
                  <div>
                    <p className='text-muted-foreground text-sm'>
                      Buy Now Price
                    </p>
                    <p className='text-lg font-semibold'>
                      {formatCurrency(selectedItem.buy_now_price)}
                    </p>
                  </div>
                )}

                <div>
                  <p className='text-muted-foreground text-sm'>
                    Quantity Available
                  </p>
                  <p className='text-lg font-semibold'>
                    {selectedItem.quantity_available}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Additional Information */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                {selectedItem.donated_by && (
                  <div>
                    <p className='text-muted-foreground text-sm'>Donated By</p>
                    <p className='font-medium'>{selectedItem.donated_by}</p>
                  </div>
                )}

                {selectedItem.item_webpage && (
                  <div>
                    <p className='text-muted-foreground text-sm'>
                      Item Webpage
                    </p>
                    <a
                      href={selectedItem.item_webpage}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-primary inline-flex items-center gap-1 hover:underline'
                    >
                      View Details
                      <ExternalLink className='h-3 w-3' />
                    </a>
                  </div>
                )}

                {selectedItem.display_priority !== null &&
                  selectedItem.display_priority !== undefined && (
                    <div>
                      <p className='text-muted-foreground text-sm'>
                        Display Priority
                      </p>
                      <p className='font-medium'>
                        {selectedItem.display_priority}
                      </p>
                    </div>
                  )}

                <div>
                  <p className='text-muted-foreground text-sm'>Created</p>
                  <p className='font-medium'>
                    {new Date(selectedItem.created_at).toLocaleString()}
                  </p>
                </div>

                <div>
                  <p className='text-muted-foreground text-sm'>Last Updated</p>
                  <p className='font-medium'>
                    {new Date(selectedItem.updated_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </AuctionItemDetailLayout>
  )
}
