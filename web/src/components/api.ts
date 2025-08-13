import axios from 'axios'

export const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000'

export const api = axios.create({
  baseURL: API_BASE,
})

export async function listItems(params?: { q?: string; category?: string }) {
  const { data } = await api.get('/api/items', { params })
  return data
}

export async function uploadIcon(file: File, meta?: { name?: string; category?: string; description?: string }) {
  const form = new FormData()
  form.append('file', file)
  if (meta?.name) form.append('name', meta.name)
  if (meta?.category) form.append('category', meta.category)
  if (meta?.description) form.append('description', meta.description)
  const { data } = await api.post('/api/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  return data
}

export async function updateItem(id: number, data: { name?: string; category?: string; icon_path?: string }): Promise<any> {
  const res = await api.put(`/api/items/${id}`, data)
  return res.data
}

export async function deleteItem(id: number): Promise<void> {
  await api.delete(`/api/items/${id}`)
}

export async function listScenes() {
  const { data } = await api.get('/api/scenes')
  return data
}

export async function createScene(name: string): Promise<{ id: number; name: string }> {
  const res = await api.post('/api/scenes', { name })
  return res.data
}

export async function updateScene(id: number, data: { name: string }): Promise<any> {
  const res = await api.put(`/api/scenes/${id}`, data)
  return res.data
}

export async function deleteScene(id: number): Promise<void> {
  await api.delete(`/api/scenes/${id}`)
}

export async function getGraph(sceneId: number) {
  const { data } = await api.get(`/api/scenes/${sceneId}/graph`)
  return data
}

export async function saveGraph(sceneId: number, payload: any) {
  const { data } = await api.put(`/api/scenes/${sceneId}/graph`, payload)
  return data
}

export async function edgeStyles() {
  const { data } = await api.get('/api/edge-styles')
  return data
}
