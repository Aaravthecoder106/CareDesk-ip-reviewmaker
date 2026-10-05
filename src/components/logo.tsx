'use client'

import Image from 'next/image'
import Link from 'next/link'

const SIZES = {
  sm: 24,
  md: 28,
  lg: 36,
} as const

interface LogoProps {
  /** Render as a link to "/" (default: true). */
  href?: string | false
  /** Show the "CareDesk" wordmark next to the mark (default: true). */
  showText?: boolean
  size?: keyof typeof SIZES
  className?: string
  /** Force white text (e.g. on the dark footer). */
  light?: boolean
}

/**
 * CareDesk brand lockup: logo mark + wordmark.
 * Single source of truth for the brand across the app.
 */
export function Logo({ href = '/', showText = true, size = 'md', className = '', light = false }: LogoProps) {
  const px = SIZES[size]

  const content = (
    <>
      <Image
        src="/logo.svg"
        alt="CareDesk logo"
        width={px}
        height={Math.round((px * 337) / 380)}
        priority
        className="shrink-0"
      />
      {showText && (
        <span
          className={`font-bold tracking-tight ${
            light ? 'text-white' : 'text-deep-navy'
          }`}
          style={{ fontSize: px * 0.76, lineHeight: 1 }}
        >
          CareDesk
        </span>
      )}
    </>
  )

  if (!href) {
    return <span className={`flex items-center gap-2 ${className}`}>{content}</span>
  }

  return (
    <Link href={href} className={`flex items-center gap-2 ${className}`} aria-label="CareDesk home">
      {content}
    </Link>
  )
}
