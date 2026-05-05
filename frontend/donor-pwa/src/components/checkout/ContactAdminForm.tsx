/**
 * ContactAdminForm — T052
 *
 * Inline expandable form for sending a message to the event admin.
 */
import { useState } from 'react'
import { ChevronDown, ChevronUp, Loader2, MessageSquare } from 'lucide-react'
import { contactAdmin } from '@/lib/api/checkout'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

const MAX_MESSAGE_LENGTH = 1000

export interface ContactAdminFormProps {
  eventId: string
  onMessageSent?: () => void
}

export function ContactAdminForm({
  eventId,
  onMessageSent,
}: ContactAdminFormProps) {
  const [expanded, setExpanded] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    if (!message.trim()) return

    setSending(true)
    setError(null)

    try {
      await contactAdmin(eventId, message.trim())
      setSuccess(true)
      setMessage('')
      onMessageSent?.()
      // Collapse after success
      setTimeout(() => {
        setExpanded(false)
        setSuccess(false)
      }, 2500)
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { status?: number; data?: { detail?: string } }
        message?: string
      }
      if (axiosErr.response?.status === 429) {
        setError(
          'You have sent too many messages recently. Please wait a moment before trying again.'
        )
      } else {
        setError(
          axiosErr.response?.data?.detail ??
            axiosErr.message ??
            'Failed to send message. Please try again.'
        )
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className='space-y-2'>
      <button
        type='button'
        onClick={() => setExpanded((prev) => !prev)}
        className='text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm underline-offset-2 transition-colors hover:underline'
      >
        <MessageSquare className='h-3.5 w-3.5' />
        Contact Admin
        {expanded ? (
          <ChevronUp className='h-3.5 w-3.5' />
        ) : (
          <ChevronDown className='h-3.5 w-3.5' />
        )}
      </button>

      {expanded && (
        <div className='space-y-2'>
          {success && (
            <Alert>
              <AlertDescription className='text-sm text-green-700'>
                Your message was sent successfully.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant='destructive'>
              <AlertDescription className='text-sm'>{error}</AlertDescription>
            </Alert>
          )}

          {!success && (
            <>
              <Textarea
                value={message}
                onChange={(e) =>
                  setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))
                }
                placeholder='Type your message to the event organizer…'
                rows={3}
                className='text-sm'
                disabled={sending}
              />
              <div className='flex items-center justify-between'>
                <span className='text-muted-foreground text-xs'>
                  {message.length}/{MAX_MESSAGE_LENGTH}
                </span>
                <Button
                  size='sm'
                  onClick={() => void handleSend()}
                  disabled={sending || !message.trim()}
                >
                  {sending ? (
                    <Loader2 className='mr-1.5 h-3.5 w-3.5 animate-spin' />
                  ) : null}
                  Send Message
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default ContactAdminForm
