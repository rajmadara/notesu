import { useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { HeaderSlotContext } from './headerSlotContext'

/** Renders its children into the toolbar's title area (see headerSlotContext). */
export function HeaderTitle({ children }: { children: ReactNode }) {
  const slot = useContext(HeaderSlotContext)
  return slot ? createPortal(children, slot) : null
}
