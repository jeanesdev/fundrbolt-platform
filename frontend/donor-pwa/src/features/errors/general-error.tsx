import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { useNavigate, useRouter } from '@tanstack/react-router'

type GeneralErrorProps = React.HTMLAttributes<HTMLDivElement> & {
  minimal?: boolean
}

export function GeneralError({
  className,
  minimal = false,
}: GeneralErrorProps) {
  const navigate = useNavigate()
  const { history } = useRouter()
  const logout = useAuthStore((s) => s.logout)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const handleSignOut = async () => {
    await logout()
    void navigate({ to: '/sign-in' })
  }

  return (
    <div className={cn('h-svh w-full', className)}>
      <div className='m-auto flex h-full w-full flex-col items-center justify-center gap-2'>
        {!minimal && (
          <h1 className='text-[7rem] leading-tight font-bold'>500</h1>
        )}
        <span className='font-medium'>Oops! Something went wrong {`:')`}</span>
        <p className='text-muted-foreground text-center'>
          We apologize for the inconvenience. <br /> Please try again later.
        </p>
        {!minimal && (
          <div className='mt-6 flex gap-4'>
            <Button variant='outline' onClick={() => history.go(-1)}>
              Go Back
            </Button>
            <Button onClick={() => navigate({ to: '/' })}>Back to Home</Button>
            {isAuthenticated && (
              <Button variant='ghost' onClick={() => void handleSignOut()}>
                Sign Out
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
