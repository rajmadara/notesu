export type TaskStatus = 'not_started' | 'in_progress' | 'done'
export type TaskPriority =
  | 'urgent_important'
  | 'urgent_not_important'
  | 'important_not_urgent'
  | 'none'

export interface Task {
  id: number
  title: string
  status: TaskStatus
  seconds: number
  running_since: number | null
  date: string
  created_at: number
  priority: TaskPriority
  tags: string
  category: string
  archived: boolean
  due_date: string | null
  item_id: number | null
  page_id: number | null
}

export interface Note {
  id: number
  task_id: number | null
  content: string
  date: string
  created_at: number
  updated_at: number
}

// --- Workspace: Space -> Item -> Pages ---

export interface Space {
  id: number
  name: string
  icon: string
  position: number
  created_at: number
}

export interface Item {
  id: number
  space_id: number
  name: string
  icon: string
  date: string | null
  location: string
  description: string
  position: number
  created_at: number
}

export type PageKind = 'overview' | 'notes' | 'checklist' | 'itinerary' | 'people'

export interface Page {
  id: number
  item_id: number
  name: string
  kind: PageKind
  content: string
  position: number
  created_at: number
}

export interface PageEntry {
  id: number
  page_id: number
  day: string | null
  time: string
  title: string
  note: string
  position: number
  created_at: number
}

export interface Person {
  id: number
  page_id: number
  name: string
  role: string
  contact: string
  note: string
  position: number
  created_at: number
}

export type SharePermission = 'view' | 'edit'
export type ItemAccess = 'owner' | 'edit' | 'view'

export interface ItemShare {
  id: number
  item_id: number
  email: string
  permission: SharePermission
  created_at: number
}

export interface SharedItem extends Item {
  owner_name: string
  permission: SharePermission
}

export interface SharedSpace extends Space {
  owner_name: string
  permission: SharePermission
}

export interface SpaceShare {
  id: number
  space_id: number
  email: string
  permission: SharePermission
  created_at: number
}

// --- Reader view ---

export interface ReadTask {
  id: number
  title: string
  done: boolean
  due_date: string | null
}

export interface ReadPerson {
  id: number
  name: string
  role: string
  contact: string
  note: string
}

export interface ReadEntry {
  id: number
  day: string | null
  time: string
  title: string
  note: string
}

export interface ReadPage {
  id: number
  name: string
  kind: PageKind
  content: string
  tasks: ReadTask[]
  entries: ReadEntry[]
  people: ReadPerson[]
}

export interface ItemReadView {
  item: {
    id: number
    name: string
    icon: string
    date: string | null
    location: string
    description: string
  }
  space: { name: string; icon: string }
  owner_name: string
  access: ItemAccess
  pages: ReadPage[]
}

export interface ItemDetail {
  item: Item
  space: Space
  pages: Page[]
  access: ItemAccess
  owner_name: string
}

export interface Habit {
  id: number
  name: string
  target_frequency: number
  created_at: number
}

export interface HabitEntry {
  id: number
  habit_id: number
  date: string
  completed: number
}
