import type { DonateNowHeroMediaItem } from '@/lib/api/donateNow'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuthStore } from '@/stores/auth-store'
import { Link } from '@tanstack/react-router'
import { LogIn } from 'lucide-react'
import { useEffect, useState } from 'react'

type HeroTransitionStyle = 'documentary_style' | 'fade' | 'swipe' | 'simple'

const documentaryKeyframes = ['heroKenBurnsA', 'heroKenBurnsB', 'heroKenBurnsC', 'heroKenBurnsD'] as const

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

interface DonateNowHeroSectionProps {
  heroMediaUrl: string | null
  mediaItems?: DonateNowHeroMediaItem[]
  transitionStyle?: string
  pageLogoUrl?: string | null
  npoName: string
}

export function DonateNowHeroSection({
  heroMediaUrl,
  mediaItems = [],
  transitionStyle = 'documentary_style',
  pageLogoUrl,
  npoName,
}: DonateNowHeroSectionProps) {
  const [activeBannerIndex, setActiveBannerIndex] = useState(0)
  const user = useAuthStore((s) => s.user)
  const getProfilePictureUrl = useAuthStore((s) => s.getProfilePictureUrl)

  const profilePictureUrl = getProfilePictureUrl()
  const initials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase()
    : 'U'

  // Prefer media_items (uploaded set) over legacy hero_media_url
  const bannerImages =
    mediaItems.length > 0 ? mediaItems.map((m) => m.file_url) : heroMediaUrl ? [heroMediaUrl] : []

  const showBanner = bannerImages.length > 0
  const safeActiveBannerIndex = bannerImages.length > 0 ? activeBannerIndex % bannerImages.length : 0
  const style = (transitionStyle ?? 'documentary_style') as HeroTransitionStyle

  useEffect(() => {
    if (bannerImages.length <= 1) return
    const intervalByStyle: Record<HeroTransitionStyle, number> = {
      documentary_style: 7000,
      fade: 5000,
      swipe: 5000,
      simple: 4000,
    }
    const intervalId = window.setInterval(() => {
      setActiveBannerIndex((prev) => (prev + 1) % bannerImages.length)
    }, intervalByStyle[style])
    return () => window.clearInterval(intervalId)
  }, [style, bannerImages.length])

  const getDocumentaryMotionStyle = (imageUrl: string, isActive: boolean) => {
    const seed = hashString(`${imageUrl}:${style}`)
    const keyframe = documentaryKeyframes[seed % documentaryKeyframes.length]
    const animationDuration = `${7.2 + (seed % 4) * 0.45}s`
    const offsetX = 48 + (seed % 5)
    const offsetY = 48 + ((seed >> 3) % 5)
    const brightness = 0.97 + (seed % 5) * 0.015
    const saturate = 0.98 + ((seed >> 2) % 5) * 0.03

    return {
      opacity: isActive ? 1 : 0,
      transform: 'scale(1.03)',
      transition: 'opacity 900ms ease',
      animation: `${keyframe} ${animationDuration} ease-in-out infinite alternate`,
      backgroundPosition: `${offsetX}% ${offsetY}%`,
      filter: `brightness(${brightness}) saturate(${saturate})`,
    }
  }

  const getSlideStyle = (index: number, imageUrl: string) => {
    const isActive = index === safeActiveBannerIndex
    const duration = style === 'simple' ? '400ms' : '900ms'

    if (style === 'swipe') {
      const distance =
        bannerImages.length > 0
          ? (index - safeActiveBannerIndex + bannerImages.length) % bannerImages.length
          : 0
      const swipeOffset = distance === 1 ? '10%' : '-10%'
      return {
        opacity: isActive ? 1 : 0,
        transform: isActive ? 'translateX(0%) scale(1.02)' : `translateX(${swipeOffset}) scale(1.02)`,
        transition: `opacity ${duration} ease, transform ${duration} ease`,
      }
    }
    if (style === 'simple') {
      return { opacity: isActive ? 1 : 0, transform: 'scale(1)', transition: `opacity ${duration} linear` }
    }
    if (style === 'fade') {
      return { opacity: isActive ? 1 : 0, transform: 'scale(1)', transition: `opacity ${duration} ease`, animation: 'none', filter: 'none' }
    }
    return getDocumentaryMotionStyle(imageUrl, isActive)
  }

  return (
    <div className='relative overflow-hidden' style={{ minHeight: '180px', height: 'min(55vw, 260px)' }}>
      <style>{`
        @keyframes heroKenBurnsA {
          0% { transform: scale(1.02) translate3d(-1.5%, -1%, 0); }
          50% { transform: scale(1.08) translate3d(1.5%, 1%, 0); }
          100% { transform: scale(1.1) translate3d(0%, 0%, 0); }
        }
        @keyframes heroKenBurnsB {
          0% { transform: scale(1.02) translate3d(1.5%, -1.5%, 0); }
          50% { transform: scale(1.07) translate3d(-1.5%, 1%, 0); }
          100% { transform: scale(1.1) translate3d(0.5%, 0%, 0); }
        }
        @keyframes heroKenBurnsC {
          0% { transform: scale(1.03) translate3d(0%, 1.5%, 0); }
          50% { transform: scale(1.08) translate3d(2%, -1%, 0); }
          100% { transform: scale(1.11) translate3d(-1%, 0%, 0); }
        }
        @keyframes heroKenBurnsD {
          0% { transform: scale(1.01) translate3d(-2%, 1%, 0); }
          50% { transform: scale(1.08) translate3d(1%, -1.5%, 0); }
          100% { transform: scale(1.1) translate3d(1.5%, 0.5%, 0); }
        }
      `}</style>

      {showBanner ? (
        <>
          {bannerImages.map((url, index) => (
            <div
              key={url}
              className='absolute inset-0 bg-cover bg-center will-change-transform'
              style={{ backgroundImage: `url(${url})`, ...getSlideStyle(index, url) }}
            />
          ))}
          <div className='pointer-events-none absolute inset-x-0 -bottom-px h-28 bg-gradient-to-t from-black/90 via-black/55 to-transparent' />
          {pageLogoUrl && (
            <div className='absolute left-4 top-4 rounded-lg bg-white/90 p-2 shadow-sm backdrop-blur-sm'>
              <img
                src={pageLogoUrl}
                alt={`${npoName} logo`}
                className='h-10 w-10 rounded object-contain sm:h-12 sm:w-12'
              />
            </div>
          )}
          <div className='absolute right-4 top-4'>
            {user ? (
              <Link
                to='/settings'
                className='flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm'
                aria-label='Profile settings'
              >
                <Avatar className='h-9 w-9'>
                  <AvatarImage
                    src={profilePictureUrl || undefined}
                    alt='Profile picture'
                  />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </Link>
            ) : (
              <Link
                to='/sign-in'
                search={{ redirect: window.location.pathname + window.location.search }}
                className='flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-sm backdrop-blur-sm'
                aria-label='Login'
              >
                <LogIn className='h-5 w-5' />
              </Link>
            )}
          </div>
          <div className='absolute bottom-0 left-0 right-0 px-4 py-5 text-white'>
            <h1 className='text-2xl font-bold sm:text-3xl'>{npoName}</h1>
          </div>
        </>
      ) : (
        <div className='flex h-full flex-col items-center justify-center bg-gradient-to-b from-gray-100 to-gray-200 px-4 py-6 text-center'>
          <h1 className='text-2xl font-bold text-gray-800 sm:text-3xl'>{npoName}</h1>
        </div>
      )}
    </div>
  )
}

