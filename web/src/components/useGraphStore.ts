import { create } from 'zustand'
import { nanoid } from 'nanoid'

type State = {
  nodes: any[]
  edges: any[]
  meta: Record<string, any>
  setGraph: (g: any) => void
}

export const useGraphStore = create<State>((set) => ({
  nodes: [],
  edges: [],
  meta: {},
  setGraph: (g) => set({ nodes: g.nodes, edges: g.edges, meta: g.meta }),
}))

export function nextNode(position = { x: 0, y: 0 }, data: any = {}, type = 'iconNode') {
  return {
    id: nanoid(8),
    type,
    position,
    data,
    draggable: true,
    selectable: true,
  }
}
