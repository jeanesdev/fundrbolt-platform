import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EventLinkForm } from '../components/EventLinkForm'
import { useEventWorkspace } from '../useEventWorkspace'

export function EventLinksSection() {
  const { currentEvent, handleLinkCreate, handleLinkDelete } =
    useEventWorkspace()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Event Links</CardTitle>
        <CardDescription>
          Add videos, websites, and social media links related to your event
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='space-y-4'>
          {currentEvent.links && currentEvent.links.length > 0 && (
            <div className='space-y-2'>
              {currentEvent.links.map((link) => (
                <Card key={link.id}>
                  <CardContent className='p-4'>
                    <div className='flex items-center justify-between gap-4'>
                      <div className='min-w-0 flex-1'>
                        <p className='font-medium'>
                          {link.label || 'Untitled Link'}
                        </p>
                        <p className='text-muted-foreground truncate text-sm'>
                          {link.url}
                        </p>
                        <p className='text-muted-foreground text-xs capitalize'>
                          {link.link_type.replace('_', ' ')}
                        </p>
                      </div>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => handleLinkDelete(link.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <EventLinkForm onSubmit={handleLinkCreate} />
        </div>
      </CardContent>
    </Card>
  )
}
