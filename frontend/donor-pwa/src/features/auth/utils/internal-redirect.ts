type InternalRedirectNavigate = (options: {
  to: string
  search?: Record<string, string>
  replace?: boolean
}) => void | Promise<void>

export function navigateToInternalRedirect(
  navigate: InternalRedirectNavigate,
  target: string,
  fallback = '/home'
) {
  const nextTarget =
    typeof target === 'string' && target.startsWith('/') ? target : fallback
  const [pathname, queryString = ''] = nextTarget.split('?')
  const search = Object.fromEntries(new URLSearchParams(queryString))

  void navigate({
    to: pathname || fallback,
    search: Object.keys(search).length > 0 ? search : undefined,
    replace: true,
  })
}
