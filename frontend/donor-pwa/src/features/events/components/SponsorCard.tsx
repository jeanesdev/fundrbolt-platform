/**
 * SponsorCard
 * Displays a single sponsor with logo thumbnail and basic info
 */
import type { Sponsor } from '@/types/sponsor'
import { Building2, Edit, ExternalLink, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface SponsorCardProps {
  sponsor: Sponsor
  onEdit?: (sponsor: Sponsor) => void
  onDelete?: (sponsor: Sponsor) => void
  readOnly?: boolean
}

export function SponsorCard({
  sponsor,
  onEdit,
  onDelete,
  readOnly = false,
}: SponsorCardProps) {
  const logoSizeLabels = {
    xsmall: 'XS',
    small: 'S',
    medium: 'M',
    large: 'L',
    xlarge: 'XL',
  }

  return (
    <Card className='overflow-hidden transition-shadow hover:shadow-md'>
      <CardContent className='p-4'>
        <div className='flex items-start gap-4'>
          {/* Logo Thumbnail - Fixed size for admin display */}
          {sponsor.website_url ? (
            <a
              href={sponsor.website_url}
              target='_blank'
              rel='noopener noreferrer'
              aria-label={`Visit ${sponsor.name} website`}
              className='cursor-pointer transition-opacity hover:opacity-80'
            >
              <div className='bg-muted flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md'>
                {sponsor.thumbnail_url || sponsor.logo_url ? (
                  <img
                    src={sponsor.thumbnail_url || sponsor.logo_url}
                    alt={`${sponsor.name} logo`}
                    className='h-full w-full object-contain'
                  />
                ) : (
                  <Building2 className='text-muted-foreground h-12 w-12' />
                )}
              </div>
            </a>
          ) : (
            <div className='bg-muted flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md'>
              {sponsor.thumbnail_url || sponsor.logo_url ? (
                <img
                  src={sponsor.thumbnail_url || sponsor.logo_url}
                  alt={`${sponsor.name} logo`}
                  className='h-full w-full object-contain'
                />
              ) : (
                <Building2 className='text-muted-foreground h-12 w-12' />
              )}
            </div>
          )}

          {/* Sponsor Info */}
          <div className='min-w-0 flex-1'>
            {/* Sponsor Name */}
            {sponsor.website_url ? (
              <a
                href={sponsor.website_url}
                target='_blank'
                rel='noopener noreferrer'
                aria-label={`Visit ${sponsor.name} website`}
              >
                <h3 className='truncate text-base font-semibold hover:underline md:text-lg'>
                  {sponsor.name}
                </h3>
              </a>
            ) : (
              <h3 className='truncate text-base font-semibold md:text-lg'>
                {sponsor.name}
              </h3>
            )}

            {/* Sponsor Level and Logo Size Badges */}
            <div className='mt-1.5 flex flex-wrap items-center gap-2'>
              {sponsor.sponsor_level && (
                <Badge variant='secondary'>{sponsor.sponsor_level}</Badge>
              )}
              <Badge variant='outline' className='text-xs'>
                Logo:{' '}
                {logoSizeLabels[sponsor.logo_size] || logoSizeLabels.medium}
              </Badge>
            </div>

            {/* Website Link */}
            {sponsor.website_url && (
              <a
                href={sponsor.website_url}
                target='_blank'
                rel='noopener noreferrer'
                className='text-primary mt-2 flex items-center gap-1 text-sm hover:underline'
              >
                <ExternalLink className='h-3 w-3' />
                Visit Website
              </a>
            )}

            {/* Contact Info */}
            {sponsor.contact_name && (
              <p className='text-muted-foreground mt-2 text-sm'>
                Contact: {sponsor.contact_name}
              </p>
            )}

            {/* Donation Amount */}
            {sponsor.donation_amount !== null &&
              sponsor.donation_amount !== undefined &&
              sponsor.donation_amount > 0 && (
                <p className='mt-2 text-sm font-medium text-green-600 dark:text-green-400'>
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  }).format(sponsor.donation_amount)}
                </p>
              )}

            {/* Actions */}
            {!readOnly && (onEdit || onDelete) && (
              <div className='mt-3 flex flex-wrap gap-2'>
                {onEdit && (
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => onEdit(sponsor)}
                    className='h-8'
                  >
                    <Edit className='mr-1.5 h-3.5 w-3.5' />
                    Edit
                  </Button>
                )}
                {onDelete && (
                  <Button
                    size='sm'
                    variant='destructive'
                    onClick={() => onDelete(sponsor)}
                    className='h-8'
                  >
                    <Trash2 className='mr-1.5 h-3.5 w-3.5' />
                    Delete
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
