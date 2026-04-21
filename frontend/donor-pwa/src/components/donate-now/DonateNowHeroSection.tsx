interface DonateNowHeroSectionProps {
  heroMediaUrl: string | null
  npoName: string
  pleaText: string | null
}

export function DonateNowHeroSection({ heroMediaUrl, npoName, pleaText }: DonateNowHeroSectionProps) {
  return (
    <div className='relative'>
      {heroMediaUrl && (
        <div className='h-48 w-full overflow-hidden sm:h-64'>
          {heroMediaUrl.match(/\.(mp4|webm|ogg)$/i) ? (
            <video
              src={heroMediaUrl}
              autoPlay
              muted
              loop
              playsInline
              className='h-full w-full object-cover'
            />
          ) : (
            <img src={heroMediaUrl} alt={npoName} className='h-full w-full object-cover' />
          )}
          <div className='absolute inset-0 bg-gradient-to-t from-black/60 to-transparent' />
        </div>
      )}
      <div className={`px-4 py-6 text-center ${heroMediaUrl ? 'absolute bottom-0 left-0 right-0 text-white' : ''}`}>
        <h1 className='text-2xl font-bold sm:text-3xl'>{npoName}</h1>
        {pleaText && <p className='mt-2 text-sm opacity-90 sm:text-base'>{pleaText}</p>}
      </div>
    </div>
  )
}
