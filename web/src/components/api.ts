import axios from 'axios'

export const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000'

export const api = axios.create({
  baseURL: API_BASE,
})

// ========== Items ==========
export async function listItems(params?: { q?: string; category?: string }) {
  const { data } = await api.get('/api/items', { params })
  return data
}

export interface UploadIconResponse {
  item?: any
  icon_url: string
}

export async function uploadIcon(
  file: File,
  meta?: { name?: string; category?: string; description?: string }
): Promise<UploadIconResponse> {
  const form = new FormData()
  form.append('file', file)
  if (meta?.name) form.append('name', meta.name)
  if (meta?.category) form.append('category', meta.category)
  if (meta?.description) form.append('description', meta.description)
  const { data } = await api.post('/api/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function updateItem(
  id: number,
  data: { name?: string; category?: string; icon_path?: string }
): Promise<any> {
  const res = await api.put(`/api/items/${id}`, data)
  return res.data
}

export async function deleteItem(id: number): Promise<void> {
  await api.delete(`/api/items/${id}`)
}

// ========== Scenes / Graph ==========
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

// ========== Categories ==========
/**
 * 兼容两类返回：
 * - ["A","B","C"]
 * - { categories: ["A","B","C"] }
 */
export async function listCategories(): Promise<string[]> {
  const { data } = await api.get('/api/categories')
  return Array.isArray(data) ? data : (data?.categories ?? [])
}

/**
 * 兼容两类返回：
 * - "NewCat"
 * - { name: "NewCat" }
 */
export async function createCategory(name: string): Promise<string> {
  const { data } = await api.post('/api/categories', { name })
  return typeof data === 'string' ? data : (data?.name ?? name)
}

/**
 * 注意：这里按“名称删分类”的后端路由写法；
 * 如果你的后端是按 id 删除，请改成 /api/categories/:id
 */
export async function deleteCategory(name: string): Promise<void> {
  await api.delete(`/api/categories/${encodeURIComponent(name)}`)
}


// 下载 ZIP
export async function exportSceneZip(sceneId: number): Promise<Blob> {
  const res = await api.get(`/api/export/scene/${sceneId}.zip`, { responseType: 'blob' })
  return res.data
}

// 上传 ZIP（导入场景）
export async function importSceneZip(file: File): Promise<{ ok: boolean; scene_id: number }> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post('/api/import/scene', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}