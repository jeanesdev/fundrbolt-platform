import LogoWhiteGold from '@fundrbolt/shared/assets/logos/fundrbolt-logo-white-gold.svg'
import { LegalFooter } from '@/components/legal/legal-footer'

type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className='flex min-h-svh flex-col'>
      <div className='container flex flex-1 items-start justify-center sm:items-center'>
        <div className='mx-auto flex w-full flex-col justify-center space-y-2 py-8 sm:w-[480px] sm:p-8'>
          <div className='mb-4 flex flex-col items-center justify-center gap-2'>
            <img src={LogoWhiteGold} alt='FundrBolt' className='h-12' />
            <span className='text-muted-foreground text-sm font-medium tracking-widest uppercase'>
              Admin Portal
            </span>
          </div>
          {children}
        </div>
      </div>
      <LegalFooter />
    </div>
  )
}
