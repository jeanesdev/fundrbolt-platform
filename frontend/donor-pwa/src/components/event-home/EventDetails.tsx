/**
 * EventDetails Component
 *
 * Collapsible section displaying event details:
 * - Venue name and address
 * - Date and time with timezone
 * - Attire requirements
 * - Contact information
 *
 * Expanded by default for upcoming events (within 30 days),
 * collapsed for past events.
 */

import * as Collapsible from '@radix-ui/react-collapsible';
import {
  Calendar,
  ChevronDown,
  Clock,
  Globe,
  Mail,
  MapPin,
  Phone,
  Shirt,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { cn, formatPhoneNumber } from '@/lib/utils';

export interface EventDetailsProps {
  /** Event date/time */
  eventDatetime: string | Date | null;
  /** Event timezone */
  timezone?: string;
  /** Venue name */
  venueName?: string | null;
  /** Venue address */
  venueAddress?: string | null;
  /** Venue city */
  venueCity?: string | null;
  /** Venue state */
  venueState?: string | null;
  /** Venue zip */
  venueZip?: string | null;
  /** Attire requirements */
  attire?: string | null;
  /** Contact email */
  contactEmail?: string | null;
  /** Contact phone */
  contactPhone?: string | null;
  /** Event website */
  eventWebsite?: string | null;
  /** Whether the event is in the past */
  isPast?: boolean;
  /** Whether the event is within 30 days */
  isUpcoming?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Detail row component
 */
function DetailRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string | null | undefined;
  href?: string;
}) {
  if (!value) return null;

  const content = href ? (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      className="underline hover:no-underline"
      style={{ color: 'rgb(var(--event-primary,59,130,246))' }}
    >
      {value}
    </a>
  ) : (
    <span style={{ color: 'var(--event-text-on-background, #000000)' }}>{value}</span>
  );

  return (
    <div className="flex items-start gap-3">
      <div>
        <Icon
          className="h-5 w-5 mt-0.5 flex-shrink-0"
          style={{ color: 'rgb(var(--event-primary,59,130,246))' }}
        />
      </div>
      <div>
        <p
          className="text-xs uppercase tracking-wide mb-0.5"
          style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
        >
          {label}
        </p>
        <p className="text-sm">{content}</p>
      </div>
    </div>
  );
}

/**
 * EventDetails component
 */
export function EventDetails({
  eventDatetime,
  timezone,
  venueName,
  venueAddress,
  venueCity,
  venueState,
  venueZip,
  attire,
  contactEmail,
  contactPhone,
  eventWebsite,
  isPast = false,
  isUpcoming: _isUpcoming = false,
  className,
}: EventDetailsProps) {
  // Determine default open state: open if event hasn't started yet
  const defaultOpen = !isPast;
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Format date and time
  const formattedDateTime = useMemo(() => {
    if (!eventDatetime) return { date: null, time: null };
    const dt = typeof eventDatetime === 'string' ? new Date(eventDatetime) : eventDatetime;
    return {
      date: dt.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      time: dt.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      }),
    };
  }, [eventDatetime]);

  // Build full address for maps link
  const mapsLink = useMemo(() => {
    if (!venueAddress) return undefined;

    // Build complete address for Google Maps
    const addressParts = [venueAddress];
    if (venueCity) addressParts.push(venueCity);
    if (venueState) addressParts.push(venueState);
    if (venueZip) addressParts.push(venueZip);

    const fullAddress = addressParts.join(', ');
    const query = encodeURIComponent(fullAddress);
    return `https://maps.google.com/?q=${query}`;
  }, [venueAddress, venueCity, venueState, venueZip]);

  // Build full address display text
  const fullAddressText = useMemo(() => {
    if (!venueAddress) return null;

    const addressParts = [venueAddress];
    if (venueCity) addressParts.push(venueCity);
    if (venueState) addressParts.push(venueState);
    if (venueZip) addressParts.push(venueZip);

    return addressParts.join(', ');
  }, [venueAddress, venueCity, venueState, venueZip]);

  // Check if we have any details to show
  const hasDetails =
    venueName ||
    venueAddress ||
    eventDatetime ||
    attire ||
    contactEmail ||
    contactPhone ||
    eventWebsite;

  if (!hasDetails) {
    return null;
  }

  return (
    <Collapsible.Root
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn('rounded-lg border', className)}
    >
      <Collapsible.Trigger asChild>
        <button
          className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors rounded-t-lg"
          aria-expanded={isOpen}
          style={{ color: 'var(--event-text-on-background, #000000)' }}
        >
          <span className="font-semibold">Event Details</span>
          <ChevronDown
            className={cn(
              'h-5 w-5 transition-transform duration-200',
              isOpen && 'rotate-180'
            )}
            style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
          />
        </button>
      </Collapsible.Trigger>

      <Collapsible.Content className="overflow-hidden data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp">
        <div className="px-4 pb-4 grid gap-4 sm:grid-cols-2">
          {/* Date & Time */}
          {formattedDateTime.date && (
            <DetailRow
              icon={Calendar}
              label="Date"
              value={formattedDateTime.date}
            />
          )}
          {formattedDateTime.time && (
            <DetailRow
              icon={Clock}
              label="Time"
              value={formattedDateTime.time}
            />
          )}

          {/* Venue */}
          {venueName && (
            <DetailRow icon={MapPin} label="Venue" value={venueName} />
          )}
          {fullAddressText && (
            <DetailRow
              icon={MapPin}
              label="Address"
              value={fullAddressText}
              href={mapsLink}
            />
          )}

          {/* Attire */}
          {attire && (
            <DetailRow icon={Shirt} label="Attire" value={attire} />
          )}

          {/* Contact */}
          {contactEmail && (
            <DetailRow
              icon={Mail}
              label="Email"
              value={contactEmail}
              href={`mailto:${contactEmail}`}
            />
          )}
          {contactPhone && (
            <DetailRow
              icon={Phone}
              label="Phone"
              value={formatPhoneNumber(contactPhone)}
              href={`tel:${contactPhone.replace(/\D/g, '')}`}
            />
          )}
          {eventWebsite && (
            <DetailRow
              icon={Globe}
              label="Website"
              value={new URL(eventWebsite).hostname}
              href={eventWebsite}
            />
          )}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

export default EventDetails;
