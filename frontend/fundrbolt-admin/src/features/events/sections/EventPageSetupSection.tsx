import { Link } from '@tanstack/react-router'
import { ArrowRight, Image } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { CauseSectionsPage } from '../cause-sections/CauseSectionsPage'
import { EventForm } from '../components/EventForm'
import { useEventWorkspace } from '../useEventWorkspace'

export function EventPageSetupSection() {
  const {
    eventId,
    currentEvent,
    npoBranding,
    handleSubmit,
    handleCancel,
    isSubmitting,
  } = useEventWorkspace()

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>Branding Colors</CardTitle>
          <CardDescription>
            Configure donor page colors, page background style, and action card
            styling.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EventForm
            event={currentEvent}
            npoId={currentEvent.npo_id}
            npoBranding={npoBranding}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={isSubmitting}
            mode='brandingOnly'
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Our Cause Page Setup</CardTitle>
          <CardDescription>
            Manage the cards that appear on the public cause page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CauseSectionsPage embedded />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Images and Videos</CardTitle>
          <CardDescription>
            Manage event media used on the donor and admin experiences.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            to='/events/$eventId/media'
            params={{ eventId }}
            className='hover:bg-accent inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors'
          >
            <Image className='h-4 w-4' />
            Go to Images &amp; Video
            <ArrowRight className='h-4 w-4' />
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
