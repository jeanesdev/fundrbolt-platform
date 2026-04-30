/**
 * Create NPO Page
 * Page for creating a new non-profit organization
 */
import { Building2 } from 'lucide-react'
import { useNpoCreation } from '@/hooks/use-npo-creation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { NPOCreationForm } from '@/components/npo/npo-creation-form'

export default function CreateNPOPage() {
  const { createNPO, isLoading } = useNpoCreation()

  return (
    <div className='container mx-auto space-y-4 px-4 py-4 sm:space-y-6 sm:px-6 sm:py-6'>
      {/* Page Header */}
      <div className='flex items-center gap-3 sm:gap-4'>
        <div className='bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg sm:h-12 sm:w-12'>
          <Building2 className='text-primary h-5 w-5 sm:h-6 sm:w-6' />
        </div>
        <div>
          <h1 className='text-2xl font-bold tracking-tight sm:text-3xl'>
            Create Organization
          </h1>
          <p className='text-muted-foreground text-sm sm:text-base'>
            Set up your non-profit organization profile
          </p>
        </div>
      </div>

      {/* Info Card */}
      <Card className='border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20'>
        <CardHeader>
          <CardTitle className='text-base sm:text-lg'>
            Getting Started
          </CardTitle>
          <CardDescription className='text-sm'>
            Your organization will be created in <strong>DRAFT</strong> status.
            You can edit details at any time before submitting for approval.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className='text-muted-foreground list-inside list-disc space-y-1 text-sm'>
            <li>
              Only <strong>Name</strong> and <strong>Email</strong> are required
              to start
            </li>
            <li>
              You can add more details later from the organization dashboard
            </li>
            <li>You'll be automatically assigned as the organization admin</li>
            <li>Submit for approval when your profile is complete</li>
          </ul>
        </CardContent>
      </Card>

      {/* Creation Form */}
      <NPOCreationForm onSubmit={createNPO} isLoading={isLoading} />
    </div>
  )
}
