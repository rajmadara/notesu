import { createContext } from 'react'

/**
 * The header's title area. Whichever page is showing portals its heading in:
 * Home the greeting, a space its name, an item its breadcrumb.
 */
export const HeaderSlotContext = createContext<HTMLElement | null>(null)
