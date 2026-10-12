import { useEffect, useRef } from 'react'

/**
 * Closes an open dropdown on an outside click or Escape. Attach the returned
 * ref to the element that wraps both the trigger and its menu.
 */
export function useDismiss(open: boolean, onDismiss: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onDismiss()
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onDismiss()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onDismiss])
  return ref
}
