import { API_ORIGIN, apiRequest } from './db'
import type {
  Item,
  ItemDetail,
  ItemReadView,
  ItemShare,
  Page,
  PageEntry,
  PageKind,
  Person,
  SharePermission,
  SharedItem,
  SharedSpace,
  Space,
  SpaceShare,
  Task,
  TaskPriority,
  TaskStatus,
} from './types'

const BASE = `${API_ORIGIN}/api/workspace`

function request<T>(path: string, options?: RequestInit): Promise<T> {
  return apiRequest<T>(BASE, path, options)
}

const json = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })
const put = (body: unknown): RequestInit => ({ method: 'PUT', body: JSON.stringify(body) })
const del: RequestInit = { method: 'DELETE' }

// --- Spaces ---

export const getSpaces = () => request<Space[]>('/spaces')
export const getSharedSpaces = () => request<SharedSpace[]>('/spaces/shared')
export const createSpace = (name: string, icon: string) =>
  request<Space>('/spaces', json({ name, icon }))
export const updateSpace = (id: number, name: string, icon: string) =>
  request<void>(`/spaces/${id}`, put({ name, icon }))
export const deleteSpace = (id: number) => request<void>(`/spaces/${id}`, del)

// --- Items ---

export const getItems = () => request<Item[]>('/items')
export const getSharedItems = () => request<SharedItem[]>('/items/shared')
export const getItemDetail = (id: number) => request<ItemDetail>(`/items/${id}`)
export const getItemReadView = (id: number) => request<ItemReadView>(`/items/${id}/read`)
export const createItem = (spaceId: number, name: string) =>
  request<Item>(`/spaces/${spaceId}/items`, json({ name }))

export interface ItemPatch {
  name?: string
  icon?: string
  date?: string | null
  location?: string
  description?: string
}
export const updateItem = (id: number, patch: ItemPatch) =>
  request<void>(`/items/${id}`, put(patch))
export const deleteItem = (id: number) => request<void>(`/items/${id}`, del)

// --- Pages ---

export const createPage = (itemId: number, name: string, kind: PageKind) =>
  request<Page>(`/items/${itemId}/pages`, json({ name, kind }))
export const renamePage = (id: number, name: string) =>
  request<void>(`/pages/${id}/name`, put({ name }))
export const setPageContent = (id: number, content: string) =>
  request<void>(`/pages/${id}/content`, put({ content }))
export const deletePage = (id: number) => request<void>(`/pages/${id}`, del)

// --- Tasks inside an item ---

export const getItemTasks = (itemId: number) => request<Task[]>(`/items/${itemId}/tasks`)
export const createPageTask = (pageId: number, title: string, due_date: string | null) =>
  request<Task>(`/pages/${pageId}/tasks`, json({ title, due_date }))

export interface ItemTaskPatch {
  title?: string
  status?: TaskStatus
  priority?: TaskPriority
  due_date?: string | null
}
export const updateItemTask = (id: number, patch: ItemTaskPatch) =>
  request<void>(`/tasks/${id}`, put(patch))
export const deleteItemTask = (id: number) => request<void>(`/tasks/${id}`, del)

// --- Itinerary entries ---

export interface EntryInput {
  day: string | null
  time: string
  title: string
  note: string
}
export const getPageEntries = (pageId: number) => request<PageEntry[]>(`/pages/${pageId}/entries`)
export const createPageEntry = (pageId: number, entry: EntryInput) =>
  request<PageEntry>(`/pages/${pageId}/entries`, json(entry))
export const updatePageEntry = (id: number, patch: Partial<EntryInput>) =>
  request<void>(`/entries/${id}`, put(patch))
export const deletePageEntry = (id: number) => request<void>(`/entries/${id}`, del)

// --- People ---

export interface PersonInput {
  name: string
  role: string
  contact: string
  note: string
}
export const getPeople = (pageId: number) => request<Person[]>(`/pages/${pageId}/people`)
export const createPerson = (pageId: number, person: PersonInput) =>
  request<Person>(`/pages/${pageId}/people`, json(person))
export const updatePerson = (id: number, patch: Partial<PersonInput>) =>
  request<void>(`/people/${id}`, put(patch))
export const deletePerson = (id: number) => request<void>(`/people/${id}`, del)

// --- Sharing ---

export const getItemShares = (itemId: number) => request<ItemShare[]>(`/items/${itemId}/shares`)
export const shareItem = (itemId: number, email: string, permission: SharePermission) =>
  request<ItemShare>(`/items/${itemId}/shares`, json({ email, permission }))
export const unshareItem = (shareId: number) => request<void>(`/shares/${shareId}`, del)

export const getSpaceShares = (spaceId: number) => request<SpaceShare[]>(`/spaces/${spaceId}/shares`)
export const shareSpace = (spaceId: number, email: string, permission: SharePermission) =>
  request<SpaceShare>(`/spaces/${spaceId}/shares`, json({ email, permission }))
export const unshareSpace = (shareId: number) => request<void>(`/space-shares/${shareId}`, del)
