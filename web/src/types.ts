export type Item = {
  id: number
  name: string
  category: string
  description: string
  icon_path: string
  created_at: string
}

export type NodeData = {
  itemId?: number
  title: string
  details?: string
  icon?: string  // url
  showDetails?: boolean
}

export type SceneGraph = {
  nodes: any[]
  edges: any[]
  meta: Record<string, any>
}
