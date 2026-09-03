import { useEffect, useRef, useState } from 'react'
import { ImagePlus, RotateCcw } from 'lucide-react'
import { ICON_EMOJI, isImageIcon } from '../../lib/icons'

// Small on purpose: the icon is stored inline on the row, and it only ever
// renders at 14–28px. 64px covers retina without bloating the row.
const ICON_PX = 64
const MAX_BYTES = 24_000

async function fileToIcon(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Could not read that image'))
      el.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = ICON_PX
    canvas.height = ICON_PX
    const ctx = canvas.getContext('2d')!
    // Cover-crop to a square from the centre, on white so transparency
    // doesn't turn black in the JPEG.
    const side = Math.min(img.width, img.height)
    const sx = (img.width - side) / 2
    const sy = (img.height - side) / 2
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, ICON_PX, ICON_PX)
    ctx.drawImage(img, sx, sy, side, side, 0, 0, ICON_PX, ICON_PX)
    // Step quality down until it fits the row's budget.
    for (const q of [0.86, 0.72, 0.6, 0.45]) {
      const out = canvas.toDataURL('image/jpeg', q)
      if (out.length <= MAX_BYTES) return out
    }
    throw new Error('That image is too detailed to shrink — try a simpler one')
  } finally {
    URL.revokeObjectURL(url)
  }
}

interface Props {
  value: string
  /** What "Reset" goes back to: 📁 for a space, 📄 for an item. */
  defaultIcon: string
  onChange: (icon: string) => void
  onClose: () => void
}

/** Emoji grid plus "use an image". Anchors below whatever opened it. */
export function IconPicker({ value, defaultIcon, onChange, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  async function pickFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      onChange(await fileToIcon(file))
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not use that image')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="icon-picker" ref={ref} role="dialog" aria-label="Choose an icon">
      <div className="icon-picker__grid" role="radiogroup" aria-label="Emoji">
        {ICON_EMOJI.map((emoji) => (
          <button
            key={emoji}
            type="button"
            role="radio"
            aria-checked={value === emoji}
            className={`icon-row__option${value === emoji ? ' is-active' : ''}`}
            onClick={() => {
              onChange(emoji)
              onClose()
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
      <div className="icon-picker__actions">
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          <ImagePlus size={14} /> {busy ? 'Working...' : 'Use an image'}
        </button>
        {(isImageIcon(value) || (value && value !== defaultIcon)) && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              onChange(defaultIcon)
              onClose()
            }}
          >
            <RotateCcw size={14} /> Reset
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  )
}
