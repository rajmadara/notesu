import { isImageIcon } from '../../lib/icons'

interface Props {
  icon: string
  /** Shown when nothing has been picked yet — 📁 for spaces, 📄 for items. */
  fallback: string
  size?: number
  className?: string
}

/** A space's or item's icon: an emoji, or a small uploaded image. */
export function EntityIcon({ icon, fallback, size = 16, className = '' }: Props) {
  if (isImageIcon(icon)) {
    return (
      <img
        className={`entity-icon entity-icon--img ${className}`}
        src={icon}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      className={`entity-icon ${className}`}
      style={{ fontSize: size * 0.9, lineHeight: 1 }}
      aria-hidden="true"
    >
      {icon || fallback}
    </span>
  )
}
