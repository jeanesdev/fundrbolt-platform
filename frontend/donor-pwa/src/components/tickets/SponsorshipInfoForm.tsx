/**
 * SponsorshipInfoForm — collects sponsorship details during checkout.
 */
import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import {
  uploadSponsorLogo,
  type SponsorshipDetails,
} from '@/lib/api/ticket-purchases'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface SponsorshipInfoFormProps {
  eventId: string
  onSubmit: (details: SponsorshipDetails) => void
  onBack: () => void
}

export function SponsorshipInfoForm({
  eventId,
  onSubmit,
  onBack,
}: SponsorshipInfoFormProps) {
  const [companyName, setCompanyName] = useState('')
  const [logoBlobName, setLogoBlobName] = useState('')
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadSponsorLogo(eventId, file),
    onSuccess: (data) => {
      setLogoBlobName(data.blob_name)
      setLogoPreview(data.preview_url)
      toast.success('Logo uploaded')
    },
    onError: () => {
      toast.error('Failed to upload logo')
    },
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    uploadMutation.mutate(file)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyName.trim() || !logoBlobName) {
      toast.error('Company name and logo are required')
      return
    }
    onSubmit({
      company_name: companyName.trim(),
      logo_blob_name: logoBlobName,
      website_url: websiteUrl.trim() || null,
      contact_name: contactName.trim() || null,
      contact_email: contactEmail.trim() || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-5'>
      <Button
        type='button'
        variant='ghost'
        size='sm'
        className='mb-2 -ml-2'
        onClick={onBack}
      >
        <ArrowLeft className='mr-1 h-4 w-4' /> Back
      </Button>

      <h2 className='text-xl font-semibold'>Sponsorship Information</h2>
      <p className='text-muted-foreground text-sm'>
        Your cart includes a sponsorship package. Please provide your company
        details.
      </p>

      <div className='space-y-2'>
        <Label htmlFor='company-name'>
          Company Name <span className='text-destructive'>*</span>
        </Label>
        <Input
          id='company-name'
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder='Your company name'
          required
        />
      </div>

      <div className='space-y-2'>
        <Label htmlFor='sponsor-logo'>
          Company Logo <span className='text-destructive'>*</span>
        </Label>
        <div className='flex items-center gap-3'>
          {logoPreview && (
            <img
              src={logoPreview}
              alt='Logo preview'
              className='h-12 w-12 rounded-md border object-contain'
            />
          )}
          <Button
            type='button'
            variant='outline'
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Uploading…
              </>
            ) : (
              <>
                <Upload className='mr-2 h-4 w-4' />
                {logoBlobName ? 'Change Logo' : 'Upload Logo'}
              </>
            )}
          </Button>
          <input
            ref={fileInputRef}
            id='sponsor-logo'
            type='file'
            accept='image/*'
            className='hidden'
            onChange={handleFileChange}
          />
        </div>
      </div>

      <div className='space-y-2'>
        <Label htmlFor='website-url'>Website URL</Label>
        <Input
          id='website-url'
          type='url'
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          placeholder='https://example.com'
        />
      </div>

      <div className='space-y-2'>
        <Label htmlFor='contact-name'>Contact Name</Label>
        <Input
          id='contact-name'
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          placeholder='John Doe'
        />
      </div>

      <div className='space-y-2'>
        <Label htmlFor='contact-email'>Contact Email</Label>
        <Input
          id='contact-email'
          type='email'
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder='john@example.com'
        />
      </div>

      <Button
        type='submit'
        className='w-full'
        disabled={!companyName.trim() || !logoBlobName}
      >
        Continue
      </Button>
    </form>
  )
}
