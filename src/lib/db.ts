import type { Note, Task, TaskPriority, TaskStatus } from './types'
import { supabase } from './supabase'

const API_ORIGIN = import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:3001`
const API_BASE = `${API_ORIGIN}/api/tasks`

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export type NoteFormatMode = 'formal' | 'informal' | 'summarize'

export async function formatNote(
  content: string,
  mode: NoteFormatMode,
): Promise<string> {
  const res = await fetch(`${API_ORIGIN}/api/ai/format-note`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, mode }),
  })
  const body = (await res.json().catch(() => null)) as
    | { content?: string; error?: string }
    | null
  if (!res.ok) {
    throw new Error(body?.error ?? `AI request failed: ${res.status}`)
  }
  return body?.content ?? ''
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    ...options,
  })
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status} ${res.statusText}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export async function getAllTasks(): Promise<Task[]> {
  return request<Task[]>('')
}

export async function createTask(title: string, category: string): Promise<Task> {
  return request<Task>('', {
    method: 'POST',
    body: JSON.stringify({ title, category }),
  })
}

export async function deleteTask(id: number): Promise<void> {
  await request<void>(`/${id}`, { method: 'DELETE' })
}

export async function setTaskTitle(id: number, title: string): Promise<void> {
  await request<void>(`/${id}/title`, {
    method: 'PUT',
    body: JSON.stringify({ title }),
  })
}

export async function setTaskStatus(
  id: number,
  status: TaskStatus,
): Promise<void> {
  await request<void>(`/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
}

export async function setTaskPriority(
  id: number,
  priority: TaskPriority,
): Promise<void> {
  await request<void>(`/${id}/priority`, {
    method: 'PUT',
    body: JSON.stringify({ priority }),
  })
}

export async function getNotesForTask(taskId: number): Promise<Note[]> {
  return request<Note[]>(`/${taskId}/notes`)
}

export async function upsertTaskNote(
  taskId: number,
  content: string,
): Promise<Note> {
  return request<Note>(`/${taskId}/notes`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  })
}
