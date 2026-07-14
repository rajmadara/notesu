import type { Note, Task, TaskPriority, TaskStatus } from './types'

const API_BASE = 'http://localhost:3001/api/tasks'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
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

export async function createTask(title: string): Promise<Task> {
  return request<Task>('', { method: 'POST', body: JSON.stringify({ title }) })
}

export async function deleteTask(id: number): Promise<void> {
  await request<void>(`/${id}`, { method: 'DELETE' })
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

export async function setTaskTags(id: number, tags: string): Promise<void> {
  await request<void>(`/${id}/tags`, {
    method: 'PUT',
    body: JSON.stringify({ tags }),
  })
}

export async function startTaskTimer(id: number): Promise<number> {
  const result = await request<{ running_since: number }>(
    `/${id}/timer/start`,
    { method: 'POST' },
  )
  return result.running_since
}

export async function stopTaskTimer(id: number): Promise<void> {
  await request<void>(`/${id}/timer/stop`, { method: 'POST' })
}

export async function resetTaskTimer(id: number): Promise<void> {
  await request<void>(`/${id}/timer/reset`, { method: 'POST' })
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
