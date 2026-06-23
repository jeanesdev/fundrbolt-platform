/**
 * EventForm Component
 * Comprehensive form for creating and editing events with all fields
 */
import { Button } from '@/components/ui/button'
import { Calendar as CalendarPicker } from '@/components/ui/calendar'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { brandingThemeTemplateApi } from '@/services/branding-theme-template-service'
import type { NPOBranding } from '@/services/event-service'
import { useAuthStore } from '@/stores/auth-store'
import type {
  BrandingThemeTemplate,
  BrandingThemeTemplateCreateRequest,
  EventCreateRequest,
  EventDetail,
  EventUpdateRequest,
  PageBackgroundStyle,
} from '@/types/event'
import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
import { zodResolver } from '@hookform/resolvers/zod'
import { format, parse } from 'date-fns'
import { CalendarIcon, MapPin } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ColorPicker } from './ColorPicker.tsx'
import { RichTextEditor } from './RichTextEditor.tsx'

const parseCurrencyInput = (value: string): number | null => {
  const sanitized = value.replace(/[^\d.]/g, '')
  if (!sanitized) return null

  const parsed = Number(sanitized)
  if (!Number.isFinite(parsed) || parsed < 0) return null

  return Math.round(parsed)
}

const formatGoalCurrency = (value: number | null | undefined): string => {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value) ||
    value < 0
  )
    return ''

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const clampOpacity = (value: number | null | undefined): number => {
  if (value === null || value === undefined || Number.isNaN(value)) return 1
  return Math.max(0, Math.min(1, value))
}

const hexToRgba = (hex: string, alpha: number): string | null => {
  const normalized = hex.trim()
  const match = /^#([0-9A-Fa-f]{6})$/.exec(normalized)
  if (!match) return null

  const [, value] = match
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// Phone number formatting helper
const formatPhoneNumber = (value: string): string => {
  const phoneNumber = value.replace(/\D/g, '')
  if (phoneNumber.length === 0) return ''

  // Handle 11-digit numbers with +1
  if (phoneNumber.length === 11 && phoneNumber.startsWith('1')) {
    const digits = phoneNumber.slice(1)
    if (digits.length <= 3) return `+1(${digits}`
    if (digits.length <= 6) return `+1(${digits.slice(0, 3)})${digits.slice(3)}`
    return `+1(${digits.slice(0, 3)})${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  // Handle 10-digit numbers
  if (phoneNumber.length <= 3) return `(${phoneNumber}`
  if (phoneNumber.length <= 6)
    return `(${phoneNumber.slice(0, 3)})${phoneNumber.slice(3)}`
  return `(${phoneNumber.slice(0, 3)})${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`
}

// Form validation schema
const eventFormSchema = z.object({
  name: z.string().min(3, 'Event name must be at least 3 characters'),
  slug: z.string().optional(),
  tagline: z
    .string()
    .max(200, 'Tagline must be under 200 characters')
    .optional(),
  hashtag: z
    .string()
    .max(100, 'Hashtag must be under 100 characters')
    .refine((value) => !value || !/\s/.test(value), {
      message: 'Hashtag cannot contain spaces',
    })
    .refine((value) => !value || /^#?[A-Za-z0-9_]+$/.test(value), {
      message: 'Hashtag can contain only letters, numbers, and underscores',
    })
    .optional(),
  description: z.string().optional(),
  event_datetime: z.string().min(1, 'Event date and time is required'),
  timezone: z.string().min(1, 'Timezone is required'),
  venue_name: z.string().optional(),
  venue_address: z.string().optional(),
  venue_city: z.string().optional(),
  venue_state: z.string().optional(),
  venue_zip: z.string().optional(),
  attire: z.string().optional(),
  fundraising_goal: z
    .number()
    .min(0, 'Goal must be zero or greater')
    .nullable()
    .optional(),
  last_year_total: z
    .number()
    .min(0, 'Last year total must be zero or greater')
    .nullable()
    .optional(),
  live_auction_start_datetime: z.string().optional(),
  auction_close_datetime: z.string().optional(),
  primary_contact_name: z.string().optional(),
  primary_contact_email: z
    .string()
    .email('Invalid email address')
    .optional()
    .or(z.literal('')),
  primary_contact_phone: z.string().optional(),
  primary_color: z.string().optional(),
  secondary_color: z.string().optional(),
  background_color: z.string().optional(),
  accent_color: z.string().optional(),
  page_background_style: z.enum(['solid', 'gradient', 'image']).optional(),
  page_background_image_url: z
    .string()
    .url('Enter a valid image URL')
    .optional()
    .or(z.literal('')),
  page_background_gradient_start_color: z.string().optional(),
  page_background_gradient_end_color: z.string().optional(),
  action_card_background_style: z.enum(['solid', 'gradient']).optional(),
  action_card_gradient_start_color: z.string().optional(),
  action_card_gradient_end_color: z.string().optional(),
  action_card_background_opacity: z
    .number()
    .min(0, 'Opacity must be at least 0%')
    .max(1, 'Opacity cannot exceed 100%')
    .optional(),
  cause_section_border_color: z.string().optional(),
  cause_section_border_width: z
    .number()
    .min(0, 'Border width must be 0 or greater')
    .max(12, 'Border width cannot exceed 12px')
    .optional(),
  table_count: z.number().nullable().optional(),
})

type EventFormValues = z.infer<typeof eventFormSchema>

interface EventFormProps {
  event?: EventDetail
  npoId: string
  npoBranding?: NPOBranding | null
  onSubmit: (
    data: EventCreateRequest & Partial<EventUpdateRequest>
  ) => Promise<void>
  onCancel?: () => void
  isSubmitting?: boolean
  mode?: 'full' | 'detailsOnly' | 'brandingOnly'
}

const SEEDED_BRANDING_THEMES: BrandingThemeTemplate[] = [
  {
    id: 'classic-gala-navy-gold',
    name: 'Classic Gala Navy & Gold',
    primary_color: '#1F2A44',
    secondary_color: '#C9A227',
    background_color: '#F7F4EA',
    accent_color: '#D4AF37',
    page_background_style: 'gradient',
    page_background_gradient_start_color: '#F7F4EA',
    page_background_gradient_end_color: '#E9DFC7',
    action_card_background_style: 'gradient',
    action_card_gradient_start_color: '#1F2A44',
    action_card_gradient_end_color: '#2D3E63',
    action_card_background_opacity: 0.95,
  },
  {
    id: 'evergreen-charity',
    name: 'Evergreen Charity',
    primary_color: '#1F5C49',
    secondary_color: '#8BBF9F',
    background_color: '#F1F8F3',
    accent_color: '#2E8B57',
    page_background_style: 'gradient',
    page_background_gradient_start_color: '#F1F8F3',
    page_background_gradient_end_color: '#DDEFE4',
    action_card_background_style: 'gradient',
    action_card_gradient_start_color: '#1F5C49',
    action_card_gradient_end_color: '#2B7A62',
    action_card_background_opacity: 0.92,
  },
  {
    id: 'sunrise-citrus',
    name: 'Sunrise Citrus',
    primary_color: '#D9480F',
    secondary_color: '#F59F00',
    background_color: '#FFF7ED',
    accent_color: '#E85D04',
    page_background_style: 'gradient',
    page_background_gradient_start_color: '#FFF7ED',
    page_background_gradient_end_color: '#FFEFD5',
    action_card_background_style: 'gradient',
    action_card_gradient_start_color: '#D9480F',
    action_card_gradient_end_color: '#F76707',
    action_card_background_opacity: 0.92,
  },
  {
    id: 'ocean-breeze',
    name: 'Ocean Breeze',
    primary_color: '#0B4F6C',
    secondary_color: '#01A7C2',
    background_color: '#F0FBFF',
    accent_color: '#0284C7',
    page_background_style: 'gradient',
    page_background_gradient_start_color: '#F0FBFF',
    page_background_gradient_end_color: '#DDF4FA',
    action_card_background_style: 'gradient',
    action_card_gradient_start_color: '#0B4F6C',
    action_card_gradient_end_color: '#11698E',
    action_card_background_opacity: 0.92,
  },
  {
    id: 'lavender-evening',
    name: 'Lavender Evening',
    primary_color: '#4B3F72',
    secondary_color: '#7E6BA8',
    background_color: '#F5F2FB',
    accent_color: '#9D4EDD',
    page_background_style: 'gradient',
    page_background_gradient_start_color: '#F5F2FB',
    page_background_gradient_end_color: '#E9E0F7',
    action_card_background_style: 'gradient',
    action_card_gradient_start_color: '#4B3F72',
    action_card_gradient_end_color: '#6A4C93',
    action_card_background_opacity: 0.92,
  },
  {
    id: 'rosewood-charity',
    name: 'Rosewood Charity',
    primary_color: '#7A1E48',
    secondary_color: '#B23A62',
    background_color: '#FFF1F6',
    accent_color: '#C9184A',
    page_background_style: 'gradient',
    page_background_gradient_start_color: '#FFF1F6',
    page_background_gradient_end_color: '#FFE4EC',
    action_card_background_style: 'gradient',
    action_card_gradient_start_color: '#7A1E48',
    action_card_gradient_end_color: '#A3345D',
    action_card_background_opacity: 0.92,
  },
  {
    id: 'midnight-neon',
    name: 'Midnight Neon',
    primary_color: '#0B132B',
    secondary_color: '#1C2541',
    background_color: '#EAF2FF',
    accent_color: '#00B4D8',
    page_background_style: 'gradient',
    page_background_gradient_start_color: '#EAF2FF',
    page_background_gradient_end_color: '#D8E7FF',
    action_card_background_style: 'gradient',
    action_card_gradient_start_color: '#0B132B',
    action_card_gradient_end_color: '#1C2541',
    action_card_background_opacity: 0.94,
  },
  {
    id: 'desert-sandstone',
    name: 'Desert Sandstone',
    primary_color: '#8C4A32',
    secondary_color: '#C97B63',
    background_color: '#FFF8F2',
    accent_color: '#D97706',
    page_background_style: 'gradient',
    page_background_gradient_start_color: '#FFF8F2',
    page_background_gradient_end_color: '#FCE8D8',
    action_card_background_style: 'gradient',
    action_card_gradient_start_color: '#8C4A32',
    action_card_gradient_end_color: '#B35C40',
    action_card_background_opacity: 0.9,
  },
  {
    id: 'forest-night',
    name: 'Forest Night',
    primary_color: '#1B4332',
    secondary_color: '#2D6A4F',
    background_color: '#EDF6F0',
    accent_color: '#52B788',
    page_background_style: 'gradient',
    page_background_gradient_start_color: '#EDF6F0',
    page_background_gradient_end_color: '#DCEEE3',
    action_card_background_style: 'gradient',
    action_card_gradient_start_color: '#1B4332',
    action_card_gradient_end_color: '#2D6A4F',
    action_card_background_opacity: 0.93,
  },
  {
    id: 'platinum-slate',
    name: 'Platinum Slate',
    primary_color: '#2F3E46',
    secondary_color: '#52796F',
    background_color: '#F6FAF9',
    accent_color: '#84A98C',
    page_background_style: 'gradient',
    page_background_gradient_start_color: '#F6FAF9',
    page_background_gradient_end_color: '#E5EFEC',
    action_card_background_style: 'gradient',
    action_card_gradient_start_color: '#2F3E46',
    action_card_gradient_end_color: '#3F5A64',
    action_card_background_opacity: 0.93,
  },
  {
    id: 'ruby-night',
    name: 'Ruby Night',
    primary_color: '#5B0E2D',
    secondary_color: '#8E2043',
    background_color: '#FFF2F6',
    accent_color: '#C1121F',
    page_background_style: 'gradient',
    page_background_gradient_start_color: '#FFF2F6',
    page_background_gradient_end_color: '#FFE5EC',
    action_card_background_style: 'gradient',
    action_card_gradient_start_color: '#5B0E2D',
    action_card_gradient_end_color: '#8E2043',
    action_card_background_opacity: 0.94,
  },
  {
    id: 'skyline-cobalt',
    name: 'Skyline Cobalt',
    primary_color: '#1D4E89',
    secondary_color: '#3A86FF',
    background_color: '#EEF5FF',
    accent_color: '#2563EB',
    page_background_style: 'gradient',
    page_background_gradient_start_color: '#EEF5FF',
    page_background_gradient_end_color: '#DDEBFF',
    action_card_background_style: 'gradient',
    action_card_gradient_start_color: '#1D4E89',
    action_card_gradient_end_color: '#2563EB',
    action_card_background_opacity: 0.93,
  },
]

// Convert a UTC date string to a local datetime-local input value (YYYY-MM-DDTHH:mm)
// datetime-local inputs interpret their value in the browser's local timezone,
// so we must format using local date methods rather than toISOString() (which gives UTC).
function toLocalDatetimeInput(utcString: string): string {
  const d = new Date(utcString)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function EventForm({
  event,
  npoId,
  npoBranding,
  onSubmit,
  onCancel,
  isSubmitting,
  mode = 'full',
}: EventFormProps) {
  // Refs for Google Maps Autocomplete
  const venueAddressInputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<any>(null) // eslint-disable-line @typescript-eslint/no-explicit-any
  const isGoogleMapsInitialized = useRef(false)

  // Seating configuration state (table_count is managed on the seating page)
  const [goalInputValue, setGoalInputValue] = useState<string>(
    formatGoalCurrency(event?.fundraising_goal ?? null)
  )
  const [lastYearTotalInputValue, setLastYearTotalInputValue] =
    useState<string>(formatGoalCurrency(event?.last_year_total ?? null))

  // Initialize form with existing event data or NPO branding defaults
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      name: event?.name || '',
      slug: event?.slug || '',
      tagline: event?.tagline || '',
      hashtag: event?.hashtag || '',
      description: event?.description || '',
      event_datetime: event?.event_datetime
        ? toLocalDatetimeInput(event.event_datetime)
        : '',
      timezone:
        event?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      venue_name: event?.venue_name || '',
      venue_address: event?.venue_address || '',
      venue_city: event?.venue_city || '',
      venue_state: event?.venue_state || '',
      venue_zip: event?.venue_zip || '',
      attire: event?.attire || '',
      fundraising_goal: event?.fundraising_goal ?? null,
      last_year_total: event?.last_year_total ?? null,
      live_auction_start_datetime: event?.live_auction_start_datetime
        ? toLocalDatetimeInput(event.live_auction_start_datetime)
        : '',
      auction_close_datetime: event?.auction_close_datetime
        ? toLocalDatetimeInput(event.auction_close_datetime)
        : '',
      primary_contact_name: event?.primary_contact_name || '',
      primary_contact_email: event?.primary_contact_email || '',
      primary_contact_phone: event?.primary_contact_phone || '',
      // Use event colors if editing, otherwise use NPO branding colors
      primary_color: event?.primary_color || npoBranding?.primary_color || '',
      secondary_color:
        event?.secondary_color || npoBranding?.secondary_color || '',
      background_color:
        event?.background_color || npoBranding?.background_color || '',
      accent_color: event?.accent_color || npoBranding?.accent_color || '',
      page_background_style: event?.page_background_style || 'solid',
      page_background_image_url: event?.page_background_image_url || '',
      page_background_gradient_start_color:
        event?.page_background_gradient_start_color ||
        event?.background_color ||
        npoBranding?.background_color ||
        '',
      page_background_gradient_end_color:
        event?.page_background_gradient_end_color ||
        event?.secondary_color ||
        npoBranding?.secondary_color ||
        '',
      action_card_background_style:
        event?.action_card_background_style === 'image'
          ? 'gradient'
          : event?.action_card_background_style || 'gradient',
      action_card_gradient_start_color:
        event?.action_card_gradient_start_color ||
        event?.primary_color ||
        npoBranding?.primary_color ||
        '',
      action_card_gradient_end_color:
        event?.action_card_gradient_end_color ||
        event?.secondary_color ||
        npoBranding?.secondary_color ||
        '',
      action_card_background_opacity:
        event?.action_card_background_opacity ?? 1,
      cause_section_border_color:
        event?.cause_section_border_color ||
        event?.primary_color ||
        npoBranding?.primary_color ||
        '',
      cause_section_border_width: event?.cause_section_border_width ?? 1,
      table_count: event?.table_count ?? null,
    },
  })

  const primaryColorValue = form.watch('primary_color') || ''
  const secondaryColorValue = form.watch('secondary_color') || ''
  const actionCardBackgroundStyle =
    form.watch('action_card_background_style') || 'gradient'
  const actionCardGradientStartColor =
    form.watch('action_card_gradient_start_color') || ''
  const actionCardGradientEndColor =
    form.watch('action_card_gradient_end_color') || ''
  const pageBackgroundStyle = form.watch('page_background_style') || 'solid'
  const actionCardBackgroundOpacity = clampOpacity(
    form.watch('action_card_background_opacity')
  )
  const causeSectionBorderWidth = form.watch('cause_section_border_width') ?? 1

  const showDetailsSections = mode !== 'brandingOnly'
  const showBrandingSection = mode !== 'detailsOnly'
  const user = useAuthStore((state) => state.user)
  const isSuperAdmin = user?.role === 'super_admin'

  const [themeTemplates, setThemeTemplates] = useState<BrandingThemeTemplate[]>(
    SEEDED_BRANDING_THEMES
  )
  const [selectedThemeId, setSelectedThemeId] = useState<string>('')
  const [themeNameDraft, setThemeNameDraft] = useState<string>('')
  const [isThemeLoading, setIsThemeLoading] = useState<boolean>(false)
  const [isThemeSaving, setIsThemeSaving] = useState<boolean>(false)

  const reloadThemeTemplates = useCallback(
    async (preferredThemeId?: string) => {
      setIsThemeLoading(true)
      try {
        const templates = await brandingThemeTemplateApi.list()
        if (templates.length > 0) {
          setThemeTemplates(templates)
          if (preferredThemeId) {
            const selected = templates.find(
              (theme) => theme.id === preferredThemeId
            )
            if (selected) {
              setSelectedThemeId(selected.id)
              setThemeNameDraft(selected.name)
            }
          }
        } else {
          setThemeTemplates(SEEDED_BRANDING_THEMES)
        }
      } catch {
        setThemeTemplates(SEEDED_BRANDING_THEMES)
      } finally {
        setIsThemeLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    void reloadThemeTemplates()
  }, [reloadThemeTemplates])

  const applyThemeTemplate = (theme: BrandingThemeTemplate) => {
    form.setValue('primary_color', theme.primary_color, { shouldDirty: true })
    form.setValue('secondary_color', theme.secondary_color, {
      shouldDirty: true,
    })
    form.setValue('background_color', theme.background_color, {
      shouldDirty: true,
    })
    form.setValue('accent_color', theme.accent_color, { shouldDirty: true })
    form.setValue('page_background_style', theme.page_background_style, {
      shouldDirty: true,
    })
    form.setValue(
      'page_background_gradient_start_color',
      theme.page_background_gradient_start_color,
      { shouldDirty: true }
    )
    form.setValue(
      'page_background_gradient_end_color',
      theme.page_background_gradient_end_color,
      { shouldDirty: true }
    )
    form.setValue(
      'action_card_background_style',
      theme.action_card_background_style,
      {
        shouldDirty: true,
      }
    )
    form.setValue(
      'action_card_gradient_start_color',
      theme.action_card_gradient_start_color,
      { shouldDirty: true }
    )
    form.setValue(
      'action_card_gradient_end_color',
      theme.action_card_gradient_end_color,
      { shouldDirty: true }
    )
    form.setValue(
      'action_card_background_opacity',
      theme.action_card_background_opacity,
      {
        shouldDirty: true,
      }
    )
  }

  const handleThemeSelection = (themeId: string) => {
    setSelectedThemeId(themeId)
    const selectedTheme = themeTemplates.find((theme) => theme.id === themeId)
    if (!selectedTheme) return
    setThemeNameDraft(selectedTheme.name)
    applyThemeTemplate(selectedTheme)
  }

  const createThemeFromCurrentValues = (
    name: string
  ): BrandingThemeTemplateCreateRequest => {
    return {
      name,
      primary_color: form.getValues('primary_color') || '#3B82F6',
      secondary_color: form.getValues('secondary_color') || '#9333EA',
      background_color: form.getValues('background_color') || '#FFFFFF',
      accent_color: form.getValues('accent_color') || '#10B981',
      page_background_style: form.getValues('page_background_style') || 'solid',
      page_background_gradient_start_color:
        form.getValues('page_background_gradient_start_color') || '#FFFFFF',
      page_background_gradient_end_color:
        form.getValues('page_background_gradient_end_color') || '#F3F4F6',
      action_card_background_style:
        form.getValues('action_card_background_style') || 'gradient',
      action_card_gradient_start_color:
        form.getValues('action_card_gradient_start_color') || '#3B82F6',
      action_card_gradient_end_color:
        form.getValues('action_card_gradient_end_color') || '#9333EA',
      action_card_background_opacity: clampOpacity(
        form.getValues('action_card_background_opacity')
      ),
    }
  }

  const handleAddTheme = async () => {
    if (!isSuperAdmin) return
    setIsThemeSaving(true)
    const nextName =
      themeNameDraft.trim() || `Custom Theme ${themeTemplates.length + 1}`
    try {
      const created = await brandingThemeTemplateApi.create(
        createThemeFromCurrentValues(nextName)
      )
      await reloadThemeTemplates(created.id)
      setSelectedThemeId(created.id)
      setThemeNameDraft(created.name)
    } finally {
      setIsThemeSaving(false)
    }
  }

  const handleRenameTheme = async () => {
    if (!isSuperAdmin || !selectedThemeId) return
    const nextName = themeNameDraft.trim()
    if (!nextName) return
    setIsThemeSaving(true)
    try {
      const updated = await brandingThemeTemplateApi.update(selectedThemeId, {
        name: nextName,
      })
      await reloadThemeTemplates(updated.id)
      setThemeNameDraft(updated.name)
    } finally {
      setIsThemeSaving(false)
    }
  }

  const handleUpdateTheme = async () => {
    if (!isSuperAdmin || !selectedThemeId) return

    const existing = themeTemplates.find(
      (theme) => theme.id === selectedThemeId
    )
    if (!existing) return
    setIsThemeSaving(true)
    try {
      const updated = await brandingThemeTemplateApi.update(selectedThemeId, {
        ...createThemeFromCurrentValues(themeNameDraft.trim() || existing.name),
      })
      await reloadThemeTemplates(updated.id)
      setThemeNameDraft(updated.name)
    } finally {
      setIsThemeSaving(false)
    }
  }

  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
  }

  const generateHashtag = (name: string): string => {
    const camel = name
      .trim()
      .split(/[\s\-_]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join('')
      .replace(/[^A-Za-z0-9]/g, '')
    return camel ? `#${camel}` : '#Event'
  }

  const normalizeHashtag = (value: string): string => {
    const trimmed = value.trim()
    if (!trimmed) return ''
    return trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  }

  const handleNameBlur = () => {
    const currentName = form.getValues('name')
    const currentSlug = form.getValues('slug')
    const currentHashtag = form.getValues('hashtag')

    // Only auto-generate if slug is empty and name has content
    if (currentName && !currentSlug) {
      const generatedSlug = generateSlug(currentName)
      form.setValue('slug', generatedSlug)
    }

    // Only auto-generate if hashtag is empty and name has content
    if (currentName && !currentHashtag) {
      const generatedHashtag = generateHashtag(currentName)
      form.setValue('hashtag', generatedHashtag)
    }
  }

  const handleHashtagBlur = () => {
    const currentHashtag = form.getValues('hashtag')
    const normalizedHashtag = normalizeHashtag(currentHashtag ?? '')

    if (normalizedHashtag !== currentHashtag) {
      form.setValue('hashtag', normalizedHashtag, {
        shouldDirty: true,
        shouldValidate: true,
      })
    }
  }

  // Initialize Google Maps Autocomplete
  useEffect(() => {
    const initAutocomplete = async () => {
      // Prevent multiple initializations
      if (!venueAddressInputRef.current || isGoogleMapsInitialized.current)
        return

      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
      if (!apiKey) {
        return
      }

      try {
        // Set options for Google Maps (only once)
        if (!isGoogleMapsInitialized.current) {
          setOptions({ key: apiKey })
          isGoogleMapsInitialized.current = true
        }

        // Import places library
        const { Autocomplete } = (await importLibrary('places')) as any // eslint-disable-line @typescript-eslint/no-explicit-any

        const autocomplete = new Autocomplete(venueAddressInputRef.current, {
          types: ['address'],
          componentRestrictions: { country: 'us' },
          fields: [
            'address_components',
            'formatted_address',
            'geometry',
            'name',
          ],
        })

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace()

          if (!place.address_components) {
            return
          }

          let street = ''
          let city = ''
          let state = ''
          let postalCode = ''

          // Parse address components
          for (const component of place.address_components) {
            const types = component.types

            if (types.includes('street_number')) {
              street = component.long_name + ' '
            } else if (types.includes('route')) {
              street += component.long_name
            } else if (types.includes('locality')) {
              city = component.long_name
            } else if (types.includes('administrative_area_level_1')) {
              state = component.short_name
            } else if (types.includes('postal_code')) {
              postalCode = component.long_name
            }
          }

          // Update form values
          form.setValue('venue_address', street.trim())
          form.setValue('venue_city', city)
          form.setValue('venue_state', state)
          form.setValue('venue_zip', postalCode)
        })

        autocompleteRef.current = autocomplete
      } catch (_error) {
        // Error loading Google Places - silently fail
      }
    }

    initAutocomplete()
  }, [form])

  useEffect(() => {
    const subscription = form.watch((values, { name }) => {
      if (name === 'fundraising_goal') {
        setGoalInputValue(formatGoalCurrency(values.fundraising_goal))
      }
      if (name === 'last_year_total') {
        setLastYearTotalInputValue(formatGoalCurrency(values.last_year_total))
      }
      if (name === 'event_datetime' && values.event_datetime) {
        const eventDate = new Date(values.event_datetime)
        if (!isNaN(eventDate.getTime())) {
          const currentStart = form.getValues('live_auction_start_datetime')
          const currentClose = form.getValues('auction_close_datetime')
          if (!currentStart) {
            const silentStart = new Date(eventDate.getTime() - 60 * 60 * 1000)
            form.setValue(
              'live_auction_start_datetime',
              toLocalDatetimeInput(silentStart.toISOString())
            )
          }
          if (!currentClose) {
            const silentClose = new Date(
              eventDate.getTime() + 2 * 60 * 60 * 1000
            )
            form.setValue(
              'auction_close_datetime',
              toLocalDatetimeInput(silentClose.toISOString())
            )
          }
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [form])

  const handleActionCardBackgroundStyleChange = (
    style: 'solid' | 'gradient'
  ) => {
    form.setValue('action_card_background_style', style, {
      shouldDirty: true,
      shouldValidate: true,
    })
  }

  const handlePageBackgroundStyleChange = (style: PageBackgroundStyle) => {
    form.setValue('page_background_style', style, {
      shouldDirty: true,
      shouldValidate: true,
    })
  }

  const handleSubmit = async (values: EventFormValues) => {
    const baseData = {
      ...values,
      hashtag: normalizeHashtag(values.hashtag ?? '') || undefined,
      npo_id: npoId,
      // Convert datetime-local to ISO string
      event_datetime: new Date(values.event_datetime).toISOString(),
      table_count: values.table_count,
      fundraising_goal: values.fundraising_goal ?? null,
      last_year_total: values.last_year_total ?? null,
      action_card_background_style:
        values.action_card_background_style || 'gradient',
      page_background_style: values.page_background_style || 'solid',
      page_background_image_url:
        values.page_background_style === 'image'
          ? values.page_background_image_url?.trim() || undefined
          : undefined,
      page_background_gradient_start_color:
        values.page_background_style === 'gradient'
          ? values.page_background_gradient_start_color?.trim() || undefined
          : undefined,
      page_background_gradient_end_color:
        values.page_background_style === 'gradient'
          ? values.page_background_gradient_end_color?.trim() || undefined
          : undefined,
      action_card_background_image_url: undefined,
      action_card_gradient_start_color:
        values.action_card_background_style === 'gradient'
          ? values.action_card_gradient_start_color?.trim() || undefined
          : undefined,
      action_card_gradient_end_color:
        values.action_card_background_style === 'gradient'
          ? values.action_card_gradient_end_color?.trim() || undefined
          : undefined,
      action_card_background_opacity: clampOpacity(
        values.action_card_background_opacity
      ),
      cause_section_border_color:
        values.cause_section_border_color?.trim() || undefined,
      cause_section_border_width: values.cause_section_border_width,
      live_auction_start_datetime: values.live_auction_start_datetime
        ? new Date(values.live_auction_start_datetime).toISOString()
        : null,
      auction_close_datetime: values.auction_close_datetime
        ? new Date(values.auction_close_datetime).toISOString()
        : null,
    }

    // Add version for optimistic locking on updates
    if (event) {
      await onSubmit({ ...baseData, version: event.version })
    } else {
      await onSubmit(baseData)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className='space-y-6 md:space-y-8'
      >
        {/* Basic Information Section */}
        {showDetailsSections && (
          <div className='space-y-4'>
            <h3 className='text-base font-semibold md:text-lg'>
              Basic Information
            </h3>

            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='Spring Gala 2025'
                      {...field}
                      onBlur={() => {
                        field.onBlur()
                        handleNameBlur()
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='slug'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug (URL)</FormLabel>
                  <FormControl>
                    <Input placeholder='spring-gala-2025' {...field} />
                  </FormControl>
                  <FormDescription>
                    Auto-generated from event name. Edit to customize the URL.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='tagline'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tagline</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='An Evening of Elegance and Impact'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Short catchy phrase (max 200 characters)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='hashtag'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Hashtag</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='#GalaForGood2026'
                      {...field}
                      onBlur={() => {
                        field.onBlur()
                        handleHashtagBlur()
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Social media hashtag for sharing. We add # automatically if
                    needed.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='description'
              render={({ field }) => (
                <FormItem>
                  <Label>Description</Label>
                  <div className='w-full overflow-hidden'>
                    <RichTextEditor
                      value={field.value || ''}
                      onChange={field.onChange}
                      placeholder='Enter event description...'
                    />
                  </div>
                  <FormDescription>
                    Full event description with formatting (Markdown supported)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {/* Date, Time & Location Section */}
        {showDetailsSections && (
          <div className='space-y-4'>
            <h3 className='flex items-center gap-2 text-base font-semibold md:text-lg'>
              <CalendarIcon className='h-4 w-4 md:h-5 md:w-5' />
              Date, Time & Location
            </h3>

            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <FormField
                control={form.control}
                name='event_datetime'
                render={({ field }) => {
                  const dateValue = field.value
                    ? parse(field.value.split('T')[0], 'yyyy-MM-dd', new Date())
                    : undefined
                  const timeValue = field.value
                    ? field.value.split('T')[1] || ''
                    : ''
                  // Parse 24h time into hour/minute/period for selects
                  const [h24, m] = timeValue
                    ? timeValue.split(':').map(Number)
                    : [0, 0]
                  const period = h24 >= 12 ? 'PM' : 'AM'
                  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24

                  const updateTime = (
                    hour12: number,
                    minute: number,
                    ampm: string
                  ) => {
                    const h =
                      ampm === 'AM'
                        ? hour12 === 12
                          ? 0
                          : hour12
                        : hour12 === 12
                          ? 12
                          : hour12 + 12
                    const newTime = `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
                    const datePart = field.value
                      ? field.value.split('T')[0]
                      : ''
                    field.onChange(datePart ? `${datePart}T${newTime}` : '')
                  }

                  return (
                    <FormItem className='min-w-0'>
                      <Label>Event Date & Time *</Label>
                      <div className='flex flex-col gap-2'>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant='outline'
                                className={cn(
                                  'w-full justify-start text-left font-normal',
                                  !dateValue && 'text-muted-foreground'
                                )}
                              >
                                <CalendarIcon className='mr-2 h-4 w-4' />
                                {dateValue
                                  ? format(dateValue, 'PPP')
                                  : 'Pick a date'}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className='w-auto p-0' align='start'>
                            <CalendarPicker
                              mode='single'
                              selected={dateValue}
                              onSelect={(day) => {
                                if (day) {
                                  const datePart = format(day, 'yyyy-MM-dd')
                                  const time = timeValue || '00:00'
                                  field.onChange(`${datePart}T${time}`)
                                }
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <div className='flex gap-2'>
                          <Select
                            value={String(h12)}
                            onValueChange={(v) =>
                              updateTime(Number(v), m, period)
                            }
                          >
                            <SelectTrigger className='w-[4.5rem]'>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 12 }, (_, i) => i + 1).map(
                                (hour) => (
                                  <SelectItem key={hour} value={String(hour)}>
                                    {hour}
                                  </SelectItem>
                                )
                              )}
                            </SelectContent>
                          </Select>
                          <span className='flex items-center text-lg font-medium'>
                            :
                          </span>
                          <Select
                            value={String(m).padStart(2, '0')}
                            onValueChange={(v) =>
                              updateTime(h12, Number(v), period)
                            }
                          >
                            <SelectTrigger className='w-[4.5rem]'>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 12 }, (_, i) => i * 5).map(
                                (min) => (
                                  <SelectItem
                                    key={min}
                                    value={String(min).padStart(2, '0')}
                                  >
                                    {String(min).padStart(2, '0')}
                                  </SelectItem>
                                )
                              )}
                            </SelectContent>
                          </Select>
                          <Select
                            value={period}
                            onValueChange={(v) => updateTime(h12, m, v)}
                          >
                            <SelectTrigger className='w-[4.5rem]'>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value='AM'>AM</SelectItem>
                              <SelectItem value='PM'>PM</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )
                }}
              />

              <FormField
                control={form.control}
                name='timezone'
                render={({ field }) => (
                  <FormItem className='min-w-0 self-start'>
                    <Label htmlFor='timezone'>Timezone *</Label>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      name={field.name}
                    >
                      <FormControl>
                        <SelectTrigger
                          id='timezone'
                          className='w-full max-w-full min-w-0'
                        >
                          <SelectValue placeholder='Select timezone' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <div className='text-muted-foreground px-2 py-1.5 text-xs font-semibold'>
                          United States
                        </div>
                        <SelectItem value='America/New_York'>
                          Eastern Time (ET)
                        </SelectItem>
                        <SelectItem value='America/Chicago'>
                          Central Time (CT)
                        </SelectItem>
                        <SelectItem value='America/Denver'>
                          Mountain Time (MT)
                        </SelectItem>
                        <SelectItem value='America/Phoenix'>
                          Arizona Time (No DST)
                        </SelectItem>
                        <SelectItem value='America/Los_Angeles'>
                          Pacific Time (PT)
                        </SelectItem>
                        <SelectItem value='America/Anchorage'>
                          Alaska Time (AKT)
                        </SelectItem>
                        <SelectItem value='Pacific/Honolulu'>
                          Hawaii Time (HT)
                        </SelectItem>
                        <div className='text-muted-foreground mt-2 border-t px-2 py-1.5 text-xs font-semibold'>
                          International
                        </div>
                        <SelectItem value='Europe/London'>
                          London (GMT/BST)
                        </SelectItem>
                        <SelectItem value='Europe/Paris'>
                          Paris (CET/CEST)
                        </SelectItem>
                        <SelectItem value='Asia/Tokyo'>Tokyo (JST)</SelectItem>
                        <SelectItem value='Asia/Shanghai'>
                          Shanghai (CST)
                        </SelectItem>
                        <SelectItem value='Asia/Dubai'>Dubai (GST)</SelectItem>
                        <SelectItem value='Australia/Sydney'>
                          Sydney (AEST/AEDT)
                        </SelectItem>
                        <SelectItem value='UTC'>
                          UTC (Coordinated Universal Time)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name='venue_name'
              render={({ field }) => (
                <FormItem>
                  <Label htmlFor='venue_name'>Venue Name</Label>
                  <FormControl>
                    <div className='relative'>
                      <MapPin className='text-muted-foreground absolute top-3 left-3 h-4 w-4' />
                      <Input
                        id='venue_name'
                        placeholder='Grand Ballroom'
                        className='pl-10'
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='venue_address'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Venue Address</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='123 Main St'
                      {...field}
                      ref={(e) => {
                        field.ref(e)
                        venueAddressInputRef.current = e
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Start typing to search for addresses
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
              <FormField
                control={form.control}
                name='venue_city'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input placeholder='New York' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='venue_state'
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor='venue_state'>State</Label>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      name={field.name}
                    >
                      <FormControl>
                        <SelectTrigger id='venue_state'>
                          <SelectValue placeholder='Select state' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='AL'>Alabama</SelectItem>
                        <SelectItem value='AK'>Alaska</SelectItem>
                        <SelectItem value='AZ'>Arizona</SelectItem>
                        <SelectItem value='AR'>Arkansas</SelectItem>
                        <SelectItem value='CA'>California</SelectItem>
                        <SelectItem value='CO'>Colorado</SelectItem>
                        <SelectItem value='CT'>Connecticut</SelectItem>
                        <SelectItem value='DE'>Delaware</SelectItem>
                        <SelectItem value='FL'>Florida</SelectItem>
                        <SelectItem value='GA'>Georgia</SelectItem>
                        <SelectItem value='HI'>Hawaii</SelectItem>
                        <SelectItem value='ID'>Idaho</SelectItem>
                        <SelectItem value='IL'>Illinois</SelectItem>
                        <SelectItem value='IN'>Indiana</SelectItem>
                        <SelectItem value='IA'>Iowa</SelectItem>
                        <SelectItem value='KS'>Kansas</SelectItem>
                        <SelectItem value='KY'>Kentucky</SelectItem>
                        <SelectItem value='LA'>Louisiana</SelectItem>
                        <SelectItem value='ME'>Maine</SelectItem>
                        <SelectItem value='MD'>Maryland</SelectItem>
                        <SelectItem value='MA'>Massachusetts</SelectItem>
                        <SelectItem value='MI'>Michigan</SelectItem>
                        <SelectItem value='MN'>Minnesota</SelectItem>
                        <SelectItem value='MS'>Mississippi</SelectItem>
                        <SelectItem value='MO'>Missouri</SelectItem>
                        <SelectItem value='MT'>Montana</SelectItem>
                        <SelectItem value='NE'>Nebraska</SelectItem>
                        <SelectItem value='NV'>Nevada</SelectItem>
                        <SelectItem value='NH'>New Hampshire</SelectItem>
                        <SelectItem value='NJ'>New Jersey</SelectItem>
                        <SelectItem value='NM'>New Mexico</SelectItem>
                        <SelectItem value='NY'>New York</SelectItem>
                        <SelectItem value='NC'>North Carolina</SelectItem>
                        <SelectItem value='ND'>North Dakota</SelectItem>
                        <SelectItem value='OH'>Ohio</SelectItem>
                        <SelectItem value='OK'>Oklahoma</SelectItem>
                        <SelectItem value='OR'>Oregon</SelectItem>
                        <SelectItem value='PA'>Pennsylvania</SelectItem>
                        <SelectItem value='RI'>Rhode Island</SelectItem>
                        <SelectItem value='SC'>South Carolina</SelectItem>
                        <SelectItem value='SD'>South Dakota</SelectItem>
                        <SelectItem value='TN'>Tennessee</SelectItem>
                        <SelectItem value='TX'>Texas</SelectItem>
                        <SelectItem value='UT'>Utah</SelectItem>
                        <SelectItem value='VT'>Vermont</SelectItem>
                        <SelectItem value='VA'>Virginia</SelectItem>
                        <SelectItem value='WA'>Washington</SelectItem>
                        <SelectItem value='WV'>West Virginia</SelectItem>
                        <SelectItem value='WI'>Wisconsin</SelectItem>
                        <SelectItem value='WY'>Wyoming</SelectItem>
                        <SelectItem value='DC'>District of Columbia</SelectItem>
                        <SelectItem value='PR'>Puerto Rico</SelectItem>
                        <SelectItem value='VI'>Virgin Islands</SelectItem>
                        <SelectItem value='GU'>Guam</SelectItem>
                        <SelectItem value='AS'>American Samoa</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='venue_zip'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ZIP Code</FormLabel>
                    <FormControl>
                      <Input placeholder='10001' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}

        {/* Event Details Section */}
        {showDetailsSections && (
          <div className='space-y-4'>
            <h3 className='text-base font-semibold md:text-lg'>
              Event Details
            </h3>

            <FormField
              control={form.control}
              name='attire'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Attire (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='e.g., Black Tie, Cocktail Attire, Business Casual'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Dress code or recommended attire for guests
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='fundraising_goal'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Goal (USD)</FormLabel>
                  <FormControl>
                    <Input
                      type='text'
                      inputMode='numeric'
                      placeholder='$500,000'
                      value={goalInputValue}
                      onFocus={(event) => {
                        const currentValue = parseCurrencyInput(
                          event.target.value
                        )
                        setGoalInputValue(
                          currentValue !== null ? String(currentValue) : ''
                        )
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                        }
                      }}
                      onChange={(event) => {
                        const rawValue = event.target.value
                        setGoalInputValue(rawValue)

                        const parsedValue = parseCurrencyInput(rawValue)
                        field.onChange(parsedValue)
                      }}
                      onBlur={(event) => {
                        field.onBlur()
                        const parsedValue = parseCurrencyInput(
                          event.target.value
                        )
                        field.onChange(parsedValue)
                        setGoalInputValue(formatGoalCurrency(parsedValue))
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Set the dashboard fundraising goal used for progress and
                    pacing.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='last_year_total'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Years Total (USD)</FormLabel>
                  <FormControl>
                    <Input
                      type='text'
                      inputMode='numeric'
                      placeholder='$425,000'
                      value={lastYearTotalInputValue}
                      onFocus={(event) => {
                        const currentValue = parseCurrencyInput(
                          event.target.value
                        )
                        setLastYearTotalInputValue(
                          currentValue !== null ? String(currentValue) : ''
                        )
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                        }
                      }}
                      onChange={(event) => {
                        const rawValue = event.target.value
                        setLastYearTotalInputValue(rawValue)

                        const parsedValue = parseCurrencyInput(rawValue)
                        field.onChange(parsedValue)
                      }}
                      onBlur={(event) => {
                        field.onBlur()
                        const parsedValue = parseCurrencyInput(
                          event.target.value
                        )
                        field.onChange(parsedValue)
                        setLastYearTotalInputValue(
                          formatGoalCurrency(parsedValue)
                        )
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional prior-year result shown in the sticky event header.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {/* Auction Timing Section */}
        {showDetailsSections && (
          <div className='space-y-4'>
            <h3 className='text-base font-semibold md:text-lg'>
              Auction Timing
            </h3>
            <p className='text-muted-foreground text-xs md:text-sm'>
              Schedule silent auction start and close times (optional). Defaults
              to 1 hour before and 2 hours after the event start time.
            </p>

            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <FormField
                control={form.control}
                name='live_auction_start_datetime'
                render={({ field }) => {
                  const dateValue = field.value
                    ? parse(field.value.split('T')[0], 'yyyy-MM-dd', new Date())
                    : undefined
                  const timeValue = field.value
                    ? field.value.split('T')[1] || ''
                    : ''
                  const [lH24, lM] = timeValue
                    ? timeValue.split(':').map(Number)
                    : [0, 0]
                  const lPeriod = lH24 >= 12 ? 'PM' : 'AM'
                  const lH12 = lH24 === 0 ? 12 : lH24 > 12 ? lH24 - 12 : lH24

                  const updateLiveTime = (
                    hour12: number,
                    minute: number,
                    ampm: string
                  ) => {
                    const h =
                      ampm === 'AM'
                        ? hour12 === 12
                          ? 0
                          : hour12
                        : hour12 === 12
                          ? 12
                          : hour12 + 12
                    const newTime = `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
                    const datePart = field.value
                      ? field.value.split('T')[0]
                      : ''
                    field.onChange(datePart ? `${datePart}T${newTime}` : '')
                  }

                  return (
                    <FormItem className='min-w-0'>
                      <FormLabel>Silent Auction Start</FormLabel>
                      <div className='flex flex-col gap-2'>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant='outline'
                                className={cn(
                                  'w-full justify-start text-left font-normal',
                                  !dateValue && 'text-muted-foreground'
                                )}
                              >
                                <CalendarIcon className='mr-2 h-4 w-4' />
                                {dateValue
                                  ? format(dateValue, 'PPP')
                                  : 'Pick a date'}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className='w-auto p-0' align='start'>
                            <CalendarPicker
                              mode='single'
                              selected={dateValue}
                              onSelect={(day) => {
                                if (day) {
                                  const datePart = format(day, 'yyyy-MM-dd')
                                  const time = timeValue || '00:00'
                                  field.onChange(`${datePart}T${time}`)
                                }
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <div className='flex gap-2'>
                          <Select
                            value={String(lH12)}
                            onValueChange={(v) =>
                              updateLiveTime(Number(v), lM, lPeriod)
                            }
                          >
                            <SelectTrigger className='w-[4.5rem]'>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 12 }, (_, i) => i + 1).map(
                                (hour) => (
                                  <SelectItem key={hour} value={String(hour)}>
                                    {hour}
                                  </SelectItem>
                                )
                              )}
                            </SelectContent>
                          </Select>
                          <span className='flex items-center text-lg font-medium'>
                            :
                          </span>
                          <Select
                            value={String(lM).padStart(2, '0')}
                            onValueChange={(v) =>
                              updateLiveTime(lH12, Number(v), lPeriod)
                            }
                          >
                            <SelectTrigger className='w-[4.5rem]'>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 12 }, (_, i) => i * 5).map(
                                (min) => (
                                  <SelectItem
                                    key={min}
                                    value={String(min).padStart(2, '0')}
                                  >
                                    {String(min).padStart(2, '0')}
                                  </SelectItem>
                                )
                              )}
                            </SelectContent>
                          </Select>
                          <Select
                            value={lPeriod}
                            onValueChange={(v) => updateLiveTime(lH12, lM, v)}
                          >
                            <SelectTrigger className='w-[4.5rem]'>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value='AM'>AM</SelectItem>
                              <SelectItem value='PM'>PM</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <FormDescription>
                        When the silent auction opens for bidding
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )
                }}
              />
              <FormField
                control={form.control}
                name='auction_close_datetime'
                render={({ field }) => {
                  const dateValue = field.value
                    ? parse(field.value.split('T')[0], 'yyyy-MM-dd', new Date())
                    : undefined
                  const timeValue = field.value
                    ? field.value.split('T')[1] || ''
                    : ''
                  const [cH24, cM] = timeValue
                    ? timeValue.split(':').map(Number)
                    : [0, 0]
                  const cPeriod = cH24 >= 12 ? 'PM' : 'AM'
                  const cH12 = cH24 === 0 ? 12 : cH24 > 12 ? cH24 - 12 : cH24

                  const updateCloseTime = (
                    hour12: number,
                    minute: number,
                    ampm: string
                  ) => {
                    const h =
                      ampm === 'AM'
                        ? hour12 === 12
                          ? 0
                          : hour12
                        : hour12 === 12
                          ? 12
                          : hour12 + 12
                    const newTime = `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
                    const datePart = field.value
                      ? field.value.split('T')[0]
                      : ''
                    field.onChange(datePart ? `${datePart}T${newTime}` : '')
                  }

                  return (
                    <FormItem className='min-w-0'>
                      <FormLabel>Silent Auction Close</FormLabel>
                      <div className='flex flex-col gap-2'>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant='outline'
                                className={cn(
                                  'w-full justify-start text-left font-normal',
                                  !dateValue && 'text-muted-foreground'
                                )}
                              >
                                <CalendarIcon className='mr-2 h-4 w-4' />
                                {dateValue
                                  ? format(dateValue, 'PPP')
                                  : 'Pick a date'}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className='w-auto p-0' align='start'>
                            <CalendarPicker
                              mode='single'
                              selected={dateValue}
                              onSelect={(day) => {
                                if (day) {
                                  const datePart = format(day, 'yyyy-MM-dd')
                                  const time = timeValue || '00:00'
                                  field.onChange(`${datePart}T${time}`)
                                }
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <div className='flex gap-2'>
                          <Select
                            value={String(cH12)}
                            onValueChange={(v) =>
                              updateCloseTime(Number(v), cM, cPeriod)
                            }
                          >
                            <SelectTrigger className='w-[4.5rem]'>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 12 }, (_, i) => i + 1).map(
                                (hour) => (
                                  <SelectItem key={hour} value={String(hour)}>
                                    {hour}
                                  </SelectItem>
                                )
                              )}
                            </SelectContent>
                          </Select>
                          <span className='flex items-center text-lg font-medium'>
                            :
                          </span>
                          <Select
                            value={String(cM).padStart(2, '0')}
                            onValueChange={(v) =>
                              updateCloseTime(cH12, Number(v), cPeriod)
                            }
                          >
                            <SelectTrigger className='w-[4.5rem]'>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 12 }, (_, i) => i * 5).map(
                                (min) => (
                                  <SelectItem
                                    key={min}
                                    value={String(min).padStart(2, '0')}
                                  >
                                    {String(min).padStart(2, '0')}
                                  </SelectItem>
                                )
                              )}
                            </SelectContent>
                          </Select>
                          <Select
                            value={cPeriod}
                            onValueChange={(v) => updateCloseTime(cH12, cM, v)}
                          >
                            <SelectTrigger className='w-[4.5rem]'>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value='AM'>AM</SelectItem>
                              <SelectItem value='PM'>PM</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <FormDescription>
                        When the silent auction closes for bidding
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )
                }}
              />
            </div>
          </div>
        )}

        {/* Contact Information Section */}
        {showDetailsSections && (
          <div className='space-y-4'>
            <h3 className='text-base font-semibold md:text-lg'>
              Primary Contact
            </h3>
            <p className='text-muted-foreground text-xs md:text-sm'>
              Contact information for event inquiries (optional)
            </p>

            <FormField
              control={form.control}
              name='primary_contact_name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Name</FormLabel>
                  <FormControl>
                    <Input placeholder='John Doe' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <FormField
                control={form.control}
                name='primary_contact_email'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Email</FormLabel>
                    <FormControl>
                      <Input
                        type='email'
                        placeholder='contact@example.com'
                        {...field}
                        onBlur={async () => {
                          field.onBlur()
                          await form.trigger('primary_contact_email')
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='primary_contact_phone'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Phone</FormLabel>
                    <FormControl>
                      <Input
                        type='tel'
                        placeholder='(555) 123-4567'
                        value={
                          field.value ? formatPhoneNumber(field.value) : ''
                        }
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, '')
                          // Only allow 10 or 11 digits (11 must start with 1)
                          if (
                            digits.length <= 10 ||
                            (digits.length === 11 && digits.startsWith('1'))
                          ) {
                            field.onChange(digits)
                          }
                        }}
                        onBlur={field.onBlur}
                        maxLength={17}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}

        {/* Branding Colors Section */}
        {showBrandingSection && (
          <div className='space-y-4'>
            <h3 className='text-base font-semibold md:text-lg'>
              Branding Colors
            </h3>
            <p className='text-muted-foreground text-xs md:text-sm'>
              Customize the event page appearance with your organization's
              colors
            </p>

            <div className='space-y-3 rounded-lg border p-4'>
              <Label>Theme Presets</Label>
              <Select
                value={selectedThemeId}
                onValueChange={handleThemeSelection}
                disabled={isThemeLoading || isThemeSaving}
              >
                <SelectTrigger>
                  <SelectValue placeholder='Select a preset theme' />
                </SelectTrigger>
                <SelectContent>
                  {themeTemplates.map((theme) => (
                    <SelectItem key={theme.id} value={theme.id}>
                      <div className='flex items-center gap-2'>
                        <span>{theme.name}</span>
                        <span className='inline-flex items-center gap-1'>
                          <span
                            className='h-3 w-3 rounded-full border'
                            style={{ backgroundColor: theme.primary_color }}
                          />
                          <span
                            className='h-3 w-3 rounded-full border'
                            style={{ backgroundColor: theme.secondary_color }}
                          />
                          <span
                            className='h-3 w-3 rounded-full border'
                            style={{ backgroundColor: theme.background_color }}
                          />
                          <span
                            className='h-3 w-3 rounded-full border'
                            style={{ backgroundColor: theme.accent_color }}
                          />
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className='text-muted-foreground text-xs'>
                Choose from shared templates with coordinated page and card
                styling. {isThemeLoading ? 'Refreshing templates...' : ''}
              </p>

              {isSuperAdmin && (
                <div className='grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto_auto]'>
                  <Input
                    value={themeNameDraft}
                    onChange={(event) => setThemeNameDraft(event.target.value)}
                    placeholder='Theme name'
                  />
                  <Button
                    type='button'
                    variant='outline'
                    onClick={handleRenameTheme}
                    disabled={
                      isThemeSaving ||
                      !selectedThemeId ||
                      !themeNameDraft.trim()
                    }
                  >
                    Rename
                  </Button>
                  <Button
                    type='button'
                    variant='outline'
                    onClick={handleUpdateTheme}
                    disabled={isThemeSaving || !selectedThemeId}
                  >
                    Update Colors
                  </Button>
                  <Button
                    type='button'
                    onClick={handleAddTheme}
                    disabled={isThemeSaving}
                  >
                    Add Theme
                  </Button>
                </div>
              )}
            </div>

            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <FormField
                control={form.control}
                name='primary_color'
                render={({ field }) => (
                  <FormItem>
                    <Label>Primary Color</Label>
                    <div>
                      <ColorPicker
                        value={field.value || ''}
                        onChange={field.onChange}
                        label='Primary'
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='secondary_color'
                render={({ field }) => (
                  <FormItem>
                    <Label>Secondary Color</Label>
                    <div>
                      <ColorPicker
                        value={field.value || ''}
                        onChange={field.onChange}
                        label='Secondary'
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='background_color'
                render={({ field }) => (
                  <FormItem>
                    <Label>Background Color</Label>
                    <div>
                      <ColorPicker
                        value={field.value || ''}
                        onChange={field.onChange}
                        label='Background'
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='accent_color'
                render={({ field }) => (
                  <FormItem>
                    <Label>Accent Color</Label>
                    <div>
                      <ColorPicker
                        value={field.value || ''}
                        onChange={field.onChange}
                        label='Accent'
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name='page_background_style'
              render={({ field }) => (
                <FormItem>
                  <Label>Page Background</Label>
                  <Select
                    value={field.value || 'solid'}
                    onValueChange={(value) =>
                      handlePageBackgroundStyleChange(
                        value as PageBackgroundStyle
                      )
                    }
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Choose page background style' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='solid'>Solid Color</SelectItem>
                      <SelectItem value='gradient'>Gradient</SelectItem>
                      <SelectItem value='image'>Image</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Controls the full page background in the donor experience.
                    Set dedicated gradient colors below when using gradient
                    mode.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='page_background_gradient_start_color'
              render={({ field }) => (
                <FormItem>
                  <Label>
                    {pageBackgroundStyle === 'gradient'
                      ? 'Page Gradient Color 1'
                      : 'Page Color'}
                  </Label>
                  <div>
                    <ColorPicker
                      value={field.value || ''}
                      onChange={field.onChange}
                      label='Page Gradient 1'
                    />
                  </div>
                  <FormDescription>
                    Used as the first stop when page background is set to
                    gradient.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {pageBackgroundStyle === 'gradient' && (
              <FormField
                control={form.control}
                name='page_background_gradient_end_color'
                render={({ field }) => (
                  <FormItem>
                    <Label>Page Gradient Color 2</Label>
                    <div>
                      <ColorPicker
                        value={field.value || ''}
                        onChange={field.onChange}
                        label='Page Gradient 2'
                      />
                    </div>
                    <FormDescription>
                      Used as the second stop when page background is set to
                      gradient.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {pageBackgroundStyle === 'image' && (
              <FormField
                control={form.control}
                name='page_background_image_url'
                render={({ field }) => (
                  <FormItem>
                    <Label>Page Background Image URL</Label>
                    <FormControl>
                      <Input
                        type='url'
                        placeholder='https://images.example.org/page-background.jpg'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Use a direct image URL for the full donor page background.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name='action_card_background_style'
              render={({ field }) => (
                <FormItem>
                  <Label>Action Card Background</Label>
                  <Select
                    value={field.value || 'gradient'}
                    onValueChange={(value) =>
                      handleActionCardBackgroundStyleChange(
                        value as 'solid' | 'gradient'
                      )
                    }
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Choose background style' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='gradient'>Gradient</SelectItem>
                      <SelectItem value='solid'>Solid Color</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Cards support solid and gradient backgrounds.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='action_card_gradient_start_color'
              render={({ field }) => (
                <FormItem>
                  <Label>
                    {actionCardBackgroundStyle === 'gradient'
                      ? 'Card Gradient Color 1'
                      : 'Card Color'}
                  </Label>
                  <div>
                    <ColorPicker
                      value={field.value || ''}
                      onChange={field.onChange}
                      label='Card Gradient 1'
                    />
                  </div>
                  <FormDescription>
                    Used as the first stop when action card background is
                    gradient.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {actionCardBackgroundStyle === 'gradient' && (
              <FormField
                control={form.control}
                name='action_card_gradient_end_color'
                render={({ field }) => (
                  <FormItem>
                    <Label>Card Gradient Color 2</Label>
                    <div>
                      <ColorPicker
                        value={field.value || ''}
                        onChange={field.onChange}
                        label='Card Gradient 2'
                      />
                    </div>
                    <FormDescription>
                      Used as the second stop when action card background is
                      gradient.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name='action_card_background_opacity'
              render={({ field }) => (
                <FormItem>
                  <Label>
                    Card Background Opacity (
                    {Math.round(actionCardBackgroundOpacity * 100)}%)
                  </Label>
                  <FormControl>
                    <Input
                      type='range'
                      min='0'
                      max='1'
                      step='0.05'
                      value={field.value ?? 1}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value)
                        field.onChange(nextValue)
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Controls how strong the action-card background appears.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='cause_section_border_color'
              render={({ field }) => (
                <FormItem>
                  <Label>Card Border Color</Label>
                  <div>
                    <ColorPicker
                      value={field.value || ''}
                      onChange={field.onChange}
                      label='Cause Border'
                    />
                  </div>
                  <FormDescription>
                    Sets the border color for built-in cause section cards in
                    the donor page.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='cause_section_border_width'
              render={({ field }) => (
                <FormItem>
                  <Label>
                    Card Border Width ({causeSectionBorderWidth}px)
                  </Label>
                  <FormControl>
                    <Input
                      type='range'
                      min='0'
                      max='12'
                      step='1'
                      value={field.value ?? 1}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value)
                        field.onChange(nextValue)
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Controls border thickness for built-in cause section cards.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='space-y-2'>
              <p className='text-muted-foreground text-xs'>
                Preview: donor action cards currently render as{' '}
                {actionCardBackgroundStyle}.
              </p>
              <div
                className='w-full rounded-2xl p-3'
                style={{
                  background:
                    actionCardBackgroundStyle === 'solid'
                      ? hexToRgba(
                        actionCardGradientStartColor ||
                        primaryColorValue ||
                        secondaryColorValue,
                        actionCardBackgroundOpacity
                      ) ||
                      `rgba(59, 130, 246, ${actionCardBackgroundOpacity})`
                      : `linear-gradient(135deg, ${hexToRgba(actionCardGradientStartColor || primaryColorValue, actionCardBackgroundOpacity) || `rgba(59, 130, 246, ${actionCardBackgroundOpacity})`} 0%, ${hexToRgba(actionCardGradientEndColor || secondaryColorValue, actionCardBackgroundOpacity) || `rgba(147, 51, 234, ${actionCardBackgroundOpacity})`} 100%)`,
                }}
              >
                <p className='text-sm font-black text-white'>
                  Purchase Additional Tickets
                </p>
                <p className='text-xs text-white/80'>
                  Buy more tickets for guests or sponsorships →
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className='flex flex-col gap-3 pt-2 sm:flex-row sm:gap-4'>
          <Button
            type='submit'
            disabled={isSubmitting}
            className='w-full sm:w-auto'
          >
            {isSubmitting
              ? 'Saving...'
              : event
                ? 'Update Event'
                : 'Create Event'}
          </Button>
          {onCancel && (
            <Button
              type='button'
              variant='outline'
              onClick={onCancel}
              className='w-full sm:w-auto'
            >
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Form>
  )
}
