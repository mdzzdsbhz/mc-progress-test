import dagre from 'dagre'

const nodeWidth = 220
const nodeHeight = 100

export function applyDagreLayout(nodes: any[], edges: any[], dir: 'LR'|'TB' = 'LR') {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: dir })
  g.setDefaultEdgeLabel(() => ({}))
  nodes.forEach((n) => g.setNode(n.id, { width: nodeWidth, height: nodeHeight }))
  edges.forEach((e) => g.setEdge(e.source, e.target))
  dagre.layout(g)
  const newNodes = nodes.map((n) => {
    const { x, y } = g.node(n.id)
    return { ...n, position: { x, y } }
  })
  return { nodes: newNodes, edges }
}
