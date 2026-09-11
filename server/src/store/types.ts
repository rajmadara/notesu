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
  /** When it was completed, in epoch seconds. Drives the weekly sweep. */
  done_at: number | null
  user_id: string
  /** Set on the main list for a task owned by someone else; '' for your own. */
  owner_name?: string
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
  user_id: string
  name: string
  icon: string
  /** Archived spaces leave the sidebar; everything inside is hidden with them. */
  archived: boolean
  position: number
  created_at: number
}

export interface Item {
  id: number
  space_id: number
  user_id: string
  name: string
  icon: string
  date: string | null
  location: string
  description: string
  /** Archived items leave the sidebar; their tasks are hidden with them. */
  archived: boolean
  position: number
  created_at: number
}

export type PageKind = 'overview' | 'notes' | 'tasks' | 'itinerary' | 'people'

export type ColumnType = 'text' | 'number' | 'select'

/** A user-defined column on a page. `options` only means anything for select. */
export interface PageColumn {
  id: string
  name: string
  type: ColumnType
  description: string
  options: string[]
}

export interface Page {
  id: number
  item_id: number
  user_id: string
  name: string
  kind: PageKind
  content: string
  columns: PageColumn[]
  position: number
  created_at: number
}

export interface PageEntry {
  id: number
  page_id: number
  user_id: string
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
  user_id: string
  name: string
  role: string
  contact: string
  note: string
  /** Values for the page's custom columns, keyed by column id. */
  fields: Record<string, string>
  position: number
  created_at: number
}

export type SharePermission = 'view' | 'edit'

export interface ItemShare {
  id: number
  item_id: number
  owner_id: string
  email: string
  permission: SharePermission
  created_at: number
}

export interface SpaceShare {
  id: number
  space_id: number
  owner_id: string
  email: string
  permission: SharePermission
  created_at: number
}

/** An item someone else shared with the current user. */
export interface SharedItem extends Item {
  owner_name: string
  permission: SharePermission
}

/** A whole space someone else shared with the current user. */
export interface SharedSpace extends Space {
  owner_name: string
  permission: SharePermission
}

// --- The reader view: one readable document, for view-only collaborators ---

/** Deliberately narrow: no user ids, no share lists, no internal columns. */
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
  fields: Record<string, string>
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
  columns: PageColumn[]
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
  access: Exclude<ItemAccess, null>
  pages: ReadPage[]
}

/**
 * What the caller may do with an item. 'owner' and 'edit' can write; 'view'
 * can only read; null means the item doesn't exist for this user at all.
 */
export type ItemAccess = 'owner' | 'edit' | 'view' | null

/** Everything a workspace needs to open in one round trip. */
export interface ItemDetail {
  item: Item
  space: Space
  pages: Page[]
  access: Exclude<ItemAccess, null>
  owner_name: string
}

export interface ItemPatch {
  name?: string
  icon?: string
  date?: string | null
  location?: string
  description?: string
}

export interface TaskPatch {
  title?: string
  status?: TaskStatus
  priority?: TaskPriority
  due_date?: string | null
  tags?: string
}

export interface EntryPatch {
  day?: string | null
  time?: string
  title?: string
  note?: string
}

export interface PersonPatch {
  name?: string
  role?: string
  contact?: string
  note?: string
  fields?: Record<string, string>
}

export interface CreateTaskOptions {
  category?: string
  due_date?: string | null
  item_id?: number | null
  page_id?: number | null
}

// Storage-agnostic contract. Implement this once per backend (Postgres/Supabase
// today, something else later) and the routes layer never has to change.
// Every method takes the caller's userId first, so no implementation can
// accidentally return or mutate another user's data.
export interface TaskStore {
  getAllTasks(userId: string): Promise<Task[]>
  searchTasks(userId: string, query: string): Promise<Task[]>
  createTask(userId: string, title: string, options: CreateTaskOptions): Promise<Task>
  deleteTask(userId: string, id: number): Promise<void>
  setTaskTitle(userId: string, id: number, title: string): Promise<void>
  setTaskStatus(userId: string, id: number, status: TaskStatus): Promise<void>
  setTaskPriority(userId: string, id: number, priority: TaskPriority): Promise<void>
  setTaskTags(userId: string, id: number, tags: string): Promise<void>
  setTaskCategory(userId: string, id: number, category: string): Promise<void>
  setTaskArchived(userId: string, id: number, archived: boolean): Promise<void>
  /**
   * Archives the caller's tasks finished more than a week ago. Returns how many
   * moved, so the route can say. Cheap enough to run on every load.
   */
  sweepArchive(userId: string): Promise<number>
  setTaskDueDate(userId: string, id: number, dueDate: string | null): Promise<void>
  startTaskTimer(userId: string, id: number): Promise<number>
  stopTaskTimer(userId: string, id: number): Promise<void>
  resetTaskTimer(userId: string, id: number): Promise<void>
  getNotesForTask(userId: string, taskId: number): Promise<Note[]>
  upsertTaskNote(userId: string, taskId: number, content: string): Promise<Note>
  /** Every tag the user has actually used, for the picker's dropdown. */
  getAllTags(userId: string): Promise<string[]>
  getFavoriteTags(userId: string): Promise<string[]>
  addFavoriteTag(userId: string, name: string): Promise<void>
  removeFavoriteTag(userId: string, name: string): Promise<void>

  // --- Spaces ---
  getSpaces(userId: string): Promise<Space[]>
  getSharedSpaces(userId: string): Promise<SharedSpace[]>
  createSpace(userId: string, name: string, icon: string): Promise<Space>
  updateSpace(userId: string, id: number, name: string, icon: string): Promise<void>
  setSpaceArchived(userId: string, id: number, archived: boolean): Promise<void>
  deleteSpace(userId: string, id: number): Promise<void>
  getSpaceShares(userId: string, spaceId: number): Promise<SpaceShare[]>
  shareSpace(userId: string, spaceId: number, email: string, permission: SharePermission): Promise<SpaceShare>
  unshareSpace(userId: string, shareId: number): Promise<void>

  // --- Items ---
  getItems(userId: string): Promise<Item[]>
  getSharedItems(userId: string): Promise<SharedItem[]>
  createItem(userId: string, spaceId: number, name: string): Promise<Item>
  getItemDetail(userId: string, itemId: number): Promise<ItemDetail | null>
  getItemReadView(userId: string, itemId: number): Promise<ItemReadView | null>
  updateItem(userId: string, id: number, patch: ItemPatch): Promise<void>
  setItemArchived(userId: string, id: number, archived: boolean): Promise<void>
  deleteItem(userId: string, id: number): Promise<void>

  // --- Pages ---
  createPage(userId: string, itemId: number, name: string, kind: PageKind): Promise<Page>
  renamePage(userId: string, id: number, name: string): Promise<void>
  setPageContent(userId: string, id: number, content: string): Promise<void>
  setPageColumns(userId: string, id: number, columns: PageColumn[]): Promise<void>
  deletePage(userId: string, id: number): Promise<void>

  // --- Tasks scoped to an item (readable by anyone the item is shared with) ---
  getItemTasks(userId: string, itemId: number): Promise<Task[]>
  /** Task notes reached through item access, so collaborators can use them. */
  getItemTaskNotes(userId: string, taskId: number): Promise<Note[]>
  upsertItemTaskNote(userId: string, taskId: number, content: string): Promise<Note>
  createPageTask(userId: string, pageId: number, title: string, dueDate: string | null): Promise<Task>
  updateItemTask(userId: string, taskId: number, patch: TaskPatch): Promise<void>
  deleteItemTask(userId: string, taskId: number): Promise<void>

  // --- Itinerary entries ---
  getPageEntries(userId: string, pageId: number): Promise<PageEntry[]>
  createPageEntry(userId: string, pageId: number, entry: Required<EntryPatch>): Promise<PageEntry>
  updatePageEntry(userId: string, id: number, patch: EntryPatch): Promise<void>
  deletePageEntry(userId: string, id: number): Promise<void>

  // --- People ---
  getPeople(userId: string, pageId: number): Promise<Person[]>
  createPerson(userId: string, pageId: number, person: Required<PersonPatch>): Promise<Person>
  updatePerson(userId: string, id: number, patch: PersonPatch): Promise<void>
  deletePerson(userId: string, id: number): Promise<void>

  // --- Sharing ---
  getItemShares(userId: string, itemId: number): Promise<ItemShare[]>
  shareItem(userId: string, itemId: number, email: string, permission: SharePermission): Promise<ItemShare>
  unshareItem(userId: string, shareId: number): Promise<void>
}
