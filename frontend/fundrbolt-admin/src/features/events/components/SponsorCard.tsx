/**
 * SponsorCard
 * Displays a single sponsor with logo thumbnail and basic info
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { Sponsor } from '@/types/sponsor'
import { Building2, Edit, ExternalLink, Trash2 } from 'lucide-react'

interface SponsorCardProps {
  sponsor: Sponsor
  onEdit?: (sponsor: Sponsor) => void
  onDelete?: (sponsor: Sponsor) => void
  readOnly?: boolean
}

export function SponsorCard({ sponsor, onEdit, onDelete, readOnly = false }: SponsorCardProps) {
  const logoSizeLabels = {
    xsmall: 'XS',
    small: 'S',
    medium: 'M',
    large: 'L',
    xlarge: 'XL',
  }

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Logo Thumbnail - Fixed size for admin display */}
          {sponsor.website_url ? (
            <a
              href={sponsor.website_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Visit ${sponsor.name} website`}
              className="cursor-pointer hover:opacity-80 transition-opacity"
            >
              <div className="shrink-0 w-24 h-24 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                {sponsor.thumbnail_url || sponsor.logo_url ? (
                  <img
                    src={sponsor.thumbnail_url || sponsor.logo_url}
                    alt={`${sponsor.name} logo`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Building2 className="w-12 h-12 text-muted-foreground" />
                )}
              </div>
            </a>
          ) : (
            <div className="shrink-0 w-24 h-24 rounded-md bg-muted flex items-center justify-center overflow-hidden">
              {sponsor.thumbnail_url || sponsor.logo_url ? (
                <img
                  src={sponsor.thumbnail_url || sponsor.logo_url}
                  alt={`${sponsor.name} logo`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <Building2 className="w-12 h-12 text-muted-foreground" />
              )}
            </div>
          )}

          {/* Sponsor Info */}
          <div className="flex-1 min-w-0">
            {/* Sponsor Name */}
            {sponsor.website_url ? (
              <a
                href={sponsor.website_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Visit ${sponsor.name} website`}
              >
                <h3 className="font-semibold text-base md:text-lg truncate hover:underline">
                  {sponsor.name}
                </h3>
              </a>
            ) : (
              <h3 className="font-semibold text-base md:text-lg truncate">{sponsor.name}</h3>
            )}

            {/* Sponsor Level and Logo Size Badges */}
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {sponsor.sponsor_level && (
                <Badge variant="secondary">
                  {sponsor.sponsor_level}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                Logo: {logoSizeLabels[sponsor.logo_size] || logoSizeLabels.medium}
              </Badge>
            </div>

            {/* Website Link */}
            {sponsor.website_url && (
              <a
                href={sponsor.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1 mt-2"
              >
                <ExternalLink className="w-3 h-3" />
                Visit Website
              </a>
            )}

            {/* Contact Info */}
            {sponsor.contact_name && (
              <p className="text-sm text-muted-foreground mt-2">
                Contact: {sponsor.contact_name}
              </p>
            )}

            {/* Donation Amount */}
            {sponsor.donation_amount !== null && sponsor.donation_amount !== undefined && sponsor.donation_amount > 0 && (
              <p className="text-sm font-medium text-green-600 dark:text-green-400 mt-2">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                }).format(sponsor.donation_amount)}
              </p>
            )}

            {/* Actions */}
            {!readOnly && (onEdit || onDelete) && (
              <div className="flex flex-wrap gap-2 mt-3">
                {onEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEdit(sponsor)}
                    className="h-8"
                  >
                    <Edit className="w-3.5 h-3.5 mr-1.5" />
                    Edit
                  </Button>
                )}
                {onDelete && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => onDelete(sponsor)}
                    className="h-8"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
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
