import { AttendeeListTable } from '@/components/admin/AttendeeListTable'
import { InviteGuestDialog } from '@/components/admin/InviteGuestDialog'
import { MealSummaryCard } from '@/components/admin/MealSummaryCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useEventWorkspace } from '../useEventWorkspace'
import { toast } from 'sonner'

export function EventRegistrationsSection() {
  const { currentEvent, eventId } = useEventWorkspace()

  const hasFoodOptions = Boolean(currentEvent.food_options?.length)

  const handleCopyRegistrationLink = () => {
    const donorUrl = `${window.location.origin.replace('5173', '5174')}/events/${currentEvent.slug || eventId}/register`
    navigator.clipboard.writeText(donorUrl)
    toast.success('Registration link copied to clipboard!')
  }

  return (
    <div className='space-y-6'>
      {hasFoodOptions && <MealSummaryCard eventId={currentEvent.id} />}

      <Card>
        <CardHeader>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
            <div>
              <CardTitle>Guest List</CardTitle>
              <CardDescription>
                View all registrants and their guests, manage invitations, and export attendee data
              </CardDescription>
            </div>
            <div className='flex flex-col sm:flex-row gap-2'>
              <InviteGuestDialog
                eventId={currentEvent.id}
                onGuestInvited={() => {
                  window.location.reload()
                }}
              />
              <Button
                onClick={handleCopyRegistrationLink}
                variant='outline'
                size='sm'
                className='shrink-0'
              >
                Copy Registration Link
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AttendeeListTable
            eventId={currentEvent.id}
            includeMealSelections={hasFoodOptions}
          />
        </CardContent>
      </Card>
    </div>
  )
}
