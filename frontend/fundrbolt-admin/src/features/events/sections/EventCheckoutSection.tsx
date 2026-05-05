/**
 * EventCheckoutSection — wraps CheckoutControlPanel for the event workspace.
 */
import { CheckoutControlPanel } from '../checkout/CheckoutControlPanel'
import { useEventWorkspace } from '../useEventWorkspace'

export function EventCheckoutSection() {
  const { currentEvent } = useEventWorkspace()

  return <CheckoutControlPanel eventId={currentEvent.id} />
}
