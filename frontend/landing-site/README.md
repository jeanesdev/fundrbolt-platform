# Augeo Landing Site

Public-facing landing page for the Augeo platform.

## Features

- **Mobile-First Design**: Responsive layout optimized for mobile devices (320px+)
- **Accessibility**: WCAG 2.1 AA compliant with keyboard navigation and screen reader support
- **Performance**: Code splitting, lazy loading, and optimized assets
- **SEO**: Meta tags, Open Graph, canonical URLs, and semantic HTML

## Getting Started

### Prerequisites

- Node.js 20+ (via nvm)
- pnpm package manager

### Installation

```bash
cd frontend/landing-site
pnpm install
```

### Development

```bash
pnpm dev
```

The app will be available at <http://localhost:3001>

### Build

```bash
pnpm build
```

### Type Check

```bash
pnpm type-check
```

### Lint

```bash
pnpm lint
```

## Project Structure

```text
src/
├── components/
│   └── layout/
│       ├── Navigation.tsx    # Mobile-first responsive navigation
│       ├── Footer.tsx         # Footer with links
│       └── PublicLayout.tsx   # Layout wrapper
├── pages/
│   └── LandingPage.tsx        # Main landing page
├── services/
│   └── api.ts                 # API client
├── App.tsx                    # Main app component with routing
├── main.tsx                   # Entry point
└── index.css                  # Global styles
```

## Mobile-First Design

This app uses a mobile-first responsive design approach:

- **Mobile**: 320px - 767px (base styles)
- **Tablet**: 768px - 1023px (first breakpoint)
- **Desktop**: 1024px+ (second breakpoint)

All components are designed to work on small screens first, then enhanced for larger screens using media queries.

## Accessibility Features

- Skip to main content link
- Semantic HTML (nav, main, footer, article)
- ARIA labels and roles
- Keyboard navigation support
- Focus indicators
- Screen reader optimizations

## Performance Optimizations

- Lazy loading of route components
- Code splitting for vendor libraries
- Optimized bundle sizes
- Browser caching
- Vite build optimizations

## Available Routes

- `/` - Landing page with hero, features, and user type CTAs
- Future routes will be added in subsequent phases

## Backend Integration

The app proxies API requests to the backend server:

- Development: `http://localhost:8000`
- Proxy configuration in `vite.config.ts`

## License

Private - Augeo Platform
