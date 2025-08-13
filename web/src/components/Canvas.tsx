
import React, { useCallback, useEffect, useState } from 'react'
import ReactFlow, {
  Background, Controls, MiniMap,
  useNodesState, useEdgesState, addEdge,
  Connection, Edge, Node, MarkerType, Handle, Position, ReactFlowInstance
} from 'reactflow'
import 'reactflow/dist/style.css'
import { toPng, toSvg } from 'html-to-image'
import { nextNode } from './useGraphStore'
import { SceneGraph } from '../types'
import { applyDagreLayout } from './layout'
import { uploadIcon, listItems, api, API_BASE } from './api'
import type { Item } from '../types'

// Helper: prefix uploads with API_BASE
const prefixUrl = (p?: string) => (p && p.startsWith('/uploads/')) ? `${API_BASE}${p}` : (p || '')

/** —— 自定义正方形节点（四边中点把手 + 标题在下） —— */
function IconNode({ data, selected }: any) {
  const iconSrc = prefixUrl(data.icon)
  const size = 120

  return (
    <div className={`mc-node ${selected ? 'selected' : ''}`} style={{ width: size, height: size }}>
      <div className="mc-node-body">
        {iconSrc
          ? <img src={iconSrc} style={{ width: 72, height: 72, objectFit: 'contain' }} />
          : <div className="mc-node-placeholder">🧱</div>}
      </div>
      <div className="mc-node-title">{data.title || '未命名'}</div>

      {/* 源把手（起点）：上 / 右 */}
      <Handle id="t" type="source" position={Position.Top} style={{ width: 10, height: 10, cursor: 'crosshair', zIndex: 5 }} />
      <Handle id="r" type="source" position={Position.Right} style={{ width: 10, height: 10, cursor: 'crosshair', zIndex: 5 }} />

      {/* 目标把手（终点）：下 / 左 */}
      <Handle id="b" type="target" position={Position.Bottom} style={{ width: 10, height: 10, cursor: 'crosshair', zIndex: 5 }} />
      <Handle id="l" type="target" position={Position.Left} style={{ width: 10, height: 10, cursor: 'crosshair', zIndex: 5 }} />
    </div>
  )
}

/** —— 伴随详情卡片 —— */
const DetailNode = ({ data }: any) => {
  const textStyle: React.CSSProperties = { fontSize: 12, color: '#374151', whiteSpace: 'pre-wrap' }
  if (data.lineClamp) {
    textStyle.overflow = 'hidden'
    textStyle.textOverflow = 'ellipsis'
    textStyle.display = '-webkit-box'
    textStyle.WebkitLineClamp = data.lineClamp
    textStyle.WebkitBoxOrient = 'vertical'
  }
  return (
    <div className="detail-node">
      <div className="detail-node-text" style={textStyle}>{data?.text || ''}</div>
    </div>
  )
}

/** —— 注册自定义节点类型 —— */
const nodeTypes = { iconNode: IconNode, detailNode: DetailNode }

export default function Canvas({
  initialGraph,
  onGraphChange
}: {
  initialGraph: SceneGraph
  onGraphChange: (g: SceneGraph) => void
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)

  // UI & 状态
  const [showDetails, setShowDetails] = useState(true)
  const [edgeStyle, setEdgeStyle] = useState<'default'|'step'|'smoothstep'|'bezier'>('step')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // 物品库（用于换图标）
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  const [invItems, setInvItems] = useState<Item[]>([])
  const [invCat, setInvCat] = useState('All')
  const [invQ, setInvQ] = useState('')
  const defaultCats = ['All', 'Blocks', 'Ores', 'Tools', 'Food', 'Mobs', 'Custom']
  async function loadInventory(q?: string, c?: string) {
    const data = await listItems({ q: q ?? invQ, category: c ?? invCat })
    setInvItems(data)
  }

  // 循环/同步防抖
  const restoringRef = React.useRef(false)
  const fromParentRef = React.useRef(false)
  const historyRef = React.useRef<{nodes:any[];edges:any[]}[]>([])
  const futureRef = React.useRef<{nodes:any[];edges:any[]}[]>([])

  // 初始化/父状态变化 -> 本地
  useEffect(() => {
    const incoming = JSON.stringify({ nodes: initialGraph.nodes || [], edges: initialGraph.edges || [], meta: initialGraph.meta || {} })
    const local = JSON.stringify({ nodes, edges, meta: {} })
    if (incoming === local) return
    fromParentRef.current = true
    setNodes(initialGraph.nodes as any)
    setEdges(initialGraph.edges as any)
    historyRef.current = [{ nodes: JSON.parse(JSON.stringify(initialGraph.nodes || [])), edges: JSON.parse(JSON.stringify(initialGraph.edges || [])) }]
    futureRef.current = []
    setTimeout(() => { fromParentRef.current = false }, 0)
    const synced0 = ensureDetailCompanions(initialGraph.nodes as any, initialGraph.edges as any)
    if (synced0.changed) {
      setNodes(synced0.nodes as any)
      setEdges(synced0.edges as any)
    }
  }, [initialGraph])

  // 打开物品库时懒加载
  useEffect(() => {
    if (iconPickerOpen && invItems.length === 0) {
      loadInventory()
    }
  }, [iconPickerOpen])

  // 伴随详情节点同步
  function ensureDetailCompanions(currNodes: any[], currEdges: any[]) {
    let changed = false
    const byId = new Map(currNodes.map((n:any)=>[n.id, n]))
    const resNodes = [...currNodes]
    const resEdges = currEdges.filter(e => !(String(e.id || '').startsWith('dedge-')))

    for (const n of currNodes) {
      if (n.type !== 'iconNode') continue
      const show = !!n.data?.showDetails
      const txt = (n.data?.details || '').trim()
      const dnid = `d-${n.id}`
      if (show && txt) {
        const pos = { x: n.position.x + 150, y: n.position.y + 10 }
        let dn = byId.get(dnid)
        const dnData = { text: txt, lineClamp: n.data.lineClamp }
        if (!dn) {
          dn = { id: dnid, type: 'detailNode', position: pos, data: dnData, draggable: false, selectable: false }
          resNodes.push(dn); changed = true
        } else {
          if (dn.data?.text !== txt || dn.position.x != pos.x || dn.position.y != pos.y || dn.data?.lineClamp !== n.data.lineClamp) {
            const idx = resNodes.findIndex(nn => nn.id === dnid)
            resNodes[idx] = { ...dn, position: pos, data: { ...dn.data, ...dnData } }
            changed = true
          }
        }
        const eid = `dedge-${n.id}`
        if (!resEdges.find(e => e.id === eid)) {
          resEdges.push({ id: eid, source: n.id, target: dnid, type: 'step', markerEnd: undefined, style: { strokeDasharray: '4 4', strokeWidth: 1.5, opacity: 0.8 } } as any)
          changed = true
        }
      } else {
        const idx = resNodes.findIndex(nn => nn.id === `d-${n.id}`)
        if (idx >= 0) { resNodes.splice(idx,1); changed = true }
      }
    }
    return { nodes: resNodes, edges: resEdges, changed }
  }

  // 本地变化 -> 通知父；并写入历史栈；并同步伴随节点
  useEffect(() => {
    if (fromParentRef.current) return
    const synced = ensureDetailCompanions(nodes as any, edges as any)
    if (synced.changed) {
      fromParentRef.current = true
      setNodes(synced.nodes as any)
      setEdges(synced.edges as any)
      setTimeout(()=>{ fromParentRef.current = false }, 0)
      return
    }
    onGraphChange({ nodes, edges, meta: {} })
    if (!restoringRef.current) {
      historyRef.current.push({ nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) })
      if (historyRef.current.length > 100) historyRef.current.shift()
      futureRef.current = []
    } else {
      restoringRef.current = false
    }
  }, [nodes, edges])

  // 连接（正交 + 实心箭头）
  const onConnect = useCallback((params: any) => {
    setEdges((eds) => addEdge({
      ...params,
      type: edgeStyle,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { strokeWidth: 2 }
    }, eds))
  }, [edgeStyle])

  // 拖入物品生成节点
  const onDrop = useCallback((ev: React.DragEvent) => {
    ev.preventDefault()
    const payload = ev.dataTransfer.getData('application/x-inventory-item')
    if (!payload) return
    const item = JSON.parse(payload)
    const bounds = (ev.currentTarget as HTMLElement).getBoundingClientRect()
    const pos = rfInstance?.project({ x: ev.clientX - bounds.left, y: ev.clientY - bounds.top }) || { x: 0, y: 0 }
    const node = nextNode(pos, { title: item.name, icon: item.icon_path, itemId: item.id, details: '', showDetails })
    setNodes((nds) => nds.concat(node as any))
  }, [rfInstance, showDetails, setNodes])

  const onDragOver = useCallback((ev: React.DragEvent) => {
    ev.preventDefault()
    ev.dataTransfer.dropEffect = 'copy'
  }, [])

  // 详情开关 + 布局
  function toggleDetails() {
    setShowDetails(v => !v)
    setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, showDetails: !showDetails } })) as any)
  }
  function autoLayout(dir: 'LR'|'TB' = 'LR') {
    const res = applyDagreLayout(nodes as any, edges as any, dir)
    setNodes(res.nodes as any)
    setEdges(res.edges as any)
  }
  function changeEdgeType(t: 'default'|'step'|'smoothstep'|'bezier') {
    setEdgeStyle(t)
    setEdges(eds => eds.map(e => ({ ...e, type: t, markerEnd: { type: MarkerType.ArrowClosed }, style: { ...e.style, strokeWidth: 2 } })) as any)
  }

  // 导出
  async function exportPNG() {
    const el = document.querySelector('.react-flow__viewport') as HTMLElement
    if (!el) return
    const dataUrl = await toPng(el, { pixelRatio: 2 })
    const a = document.createElement('a')
    a.download = 'canvas.png'; a.href = dataUrl; a.click()
  }
  async function exportSVG() {
    const el = document.querySelector('.react-flow__viewport') as HTMLElement
    if (!el) return
    const dataUrl = await toSvg(el)
    let svgString = dataUrl;
    if (dataUrl.startsWith('data:image/svg+xml;base64,')) {
      svgString = atob(dataUrl.substring('data:image/svg+xml;base64,'.length));
    }
    const blob = new Blob([svgString], { type: 'image/svg+xml' })
    const a = document.createElement('a')
    a.download = 'canvas.svg'; a.href = URL.createObjectURL(blob); a.click()
  }

  // 一些生成器（分叉/短横/层级）
  function addFork(children = 3) {
    const sel = nodes.find(n => (n as any).selected)
    if (!sel) return alert('请选择一个节点作为分叉源')
    const startX = (sel as any).position.x + 260
    const baseY = (sel as any).position.y - (children - 1) * 60
    const newNodes: any[] = []
    const newEdges: any[] = []
    for (let i = 0; i < children; i++) {
      const n = nextNode({ x: startX, y: baseY + i * 120 }, { title: `子节点 ${i + 1}`, showDetails })
      newNodes.push(n as any)
      newEdges.push({ id: `e_${(sel as any).id}_${(n as any).id}`, source: (sel as any).id, target: (n as any).id, type: edgeStyle, markerEnd: { type: MarkerType.ArrowClosed } })
    }
    setNodes(nds => nds.concat(newNodes as any))
    setEdges(eds => eds.concat(newEdges as any))
    autoLayout('LR')
  }
  function addShortHorizontal() {
    const sel = nodes.find(n => (n as any).selected)
    if (!sel) return alert('请选择一个节点')
    const j = nextNode({ x: (sel as any).position.x + 120, y: (sel as any).position.y + 10 }, { title: '—', showDetails: false }, 'iconNode')
    setNodes(nds => nds.concat(j as any))
    setEdges(eds => eds.concat({ id: `e_${(sel as any).id}_${(j as any).id}`, source: (sel as any).id, target: (j as any).id, type: 'step', markerEnd: { type: MarkerType.ArrowClosed } } as any))
  }
  function generateHierarchy(depth = 3, breadth = 3) {
    const x0 = 100, y0 = 100
    const root = nextNode({ x: x0, y: y0 }, { title: '根节点', showDetails })
    const newNodes: any[] = [root as any]
    const newEdges: any[] = []
    let level: any[] = [root]
    for (let d = 1; d < depth; d++) {
      const next: any[] = []
      for (const parent of level) {
        for (let b = 0; b < breadth; b++) {
          const n = nextNode({ x: 0, y: 0 }, { title: `L${d} 节点`, showDetails })
          next.push(n as any); newNodes.push(n as any)
          newEdges.push({ id: `e_${(parent as any).id}_${(n as any).id}`, source: (parent as any).id, target: (n as any).id, type: edgeStyle, markerEnd: { type: MarkerType.ArrowClosed } })
        }
      }
      level = next
    }
    setNodes(nds => nds.concat(newNodes as any))
    setEdges(eds => eds.concat(newEdges as any))
    autoLayout('LR')
  }

  // 撤销/重做
  function undo() {
    if (historyRef.current.length <= 1) return
    const current = historyRef.current.pop()!
    const prev = historyRef.current[historyRef.current.length - 1]
    futureRef.current.push(current!)
    restoringRef.current = true
    setNodes(prev.nodes as any); setEdges(prev.edges as any)
  }
  function redo() {
    const next = futureRef.current.pop()
    if (!next) return
    restoringRef.current = true
    historyRef.current.push({ nodes: JSON.parse(JSON.stringify(next.nodes)), edges: JSON.parse(JSON.stringify(next.edges)) })
    setNodes(next.nodes as any); setEdges(next.edges as any)
  }
  function onKeyDown(ev: React.KeyboardEvent) {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); undo() }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'y') { ev.preventDefault(); redo() }
  }

  // 右上角浮层（属性）
  const detailsOverlay = selectedId ? (() => {
    const node = (nodes as any[]).find(n => n.id === selectedId)
    if (!node) return null
    const data = node.data || {}
    return (
      <div
        className="details-panel"
        style={{ pointerEvents: 'all' }}
        onMouseDown={(e)=>e.stopPropagation()}
        onClick={(e)=>e.stopPropagation()}
      >
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div style={{fontWeight:700}}>节点属性</div>
          <button className="btn ghost" onClick={()=>setSelectedId(null)}>关闭</button>
        </div>
        <div style={{display:'grid', gap:8, marginTop:8}}>
          <label style={{fontSize:12, color:'#6b7280'}}>标题</label>
          <input className="inv-search" value={data.title || ''} onChange={e => setNodes(nds => nds.map(n => n.id === selectedId ? ({ ...n, data: { ...n.data, title: e.target.value } }) : n) as any)} />
          <label style={{fontSize:12, color:'#6b7280'}}>详细信息</label>
          <textarea className="inv-search" rows={6} value={data.details || ''} onChange={e => setNodes(nds => nds.map(n => n.id === selectedId ? ({ ...n, data: { ...n.data, details: e.target.value } }) : n) as any)} />
          <label style={{fontSize:12, color:'#6b7280'}}>行数限制 (0为不限制)</label>
          <input type="number" className="inv-search" value={data.lineClamp || ''} onChange={e => setNodes(nds => nds.map(n => n.id === selectedId ? ({ ...n, data: { ...n.data, lineClamp: e.target.value ? parseInt(e.target.value) : undefined } }) : n) as any)} />
          <label style={{fontSize:12, color:'#6b7280'}}>图标</label>
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            {data.icon ? <img src={prefixUrl(data.icon)} style={{width:40,height:40,objectFit:'contain'}}/> : <div>（未设置）</div>}
            <button className="btn" onClick={()=>{ setIconPickerOpen(true); loadInventory(); }}>从物品库选择</button>
          </div>
          <label style={{display:'flex', alignItems:'center', gap:8}}>
            <input type="checkbox" checked={!!data.showDetails} onChange={e => setNodes(nds => nds.map(n => n.id === selectedId ? ({ ...n, data: { ...n.data, showDetails: e.target.checked } }) : n) as any)} />
            展开详细信息（在图标旁显示）
          </label>
        </div>
      </div>
    )
  })() : null

  return (
    <div style={{ height: '100%' }} onKeyDown={onKeyDown} tabIndex={0}>
      {/* 顶部工具条 */}
      <div style={{ position: 'absolute', zIndex: 10, left: 320, top: 8, display: 'flex', gap: 8 }}>
        <button className="btn" onClick={() => toggleDetails()}>{showDetails ? '折叠详细信息' : '展开详细信息'}</button>
        <button className="btn" onClick={() => autoLayout('LR')}>自动布局 LR</button>
        <button className="btn" onClick={() => autoLayout('TB')}>自动布局 TB</button>
        <div className="sep"></div>
        <select className="btn" value={edgeStyle} onChange={e => changeEdgeType(e.target.value as any)}>
          <option value="default">直线</option>
          <option value="step">正交折线</option>
          <option value="smoothstep">圆角折线</option>
          <option value="bezier">贝塞尔</option>
        </select>
        <div className="sep"></div>
        <button className="btn" onClick={() => addShortHorizontal()}>短横</button>
        <button className="btn" onClick={() => addFork(3)}>分叉×3</button>
        <button className="btn" onClick={() => generateHierarchy(3,3)}>独立层级</button>
        <div className="sep"></div>
        <button className="btn" onClick={() => exportPNG()}>导出PNG</button>
        <button className="btn" onClick={() => exportSVG()}>导出SVG</button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={(inst) => setRfInstance(inst)}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onSelectionChange={({ nodes }) => setSelectedId(nodes?.[0]?.id ?? null)}
        fitView
        deleteKeyCode={['Backspace', 'Delete']}
        selectionOnDrag

        connectionMode={'loose' as any}
        connectionRadius={30}
        connectOnClick
        connectionLineType={'step' as any}
        defaultEdgeOptions={{ type: edgeStyle || 'step', markerEnd: { type: MarkerType.ArrowClosed }, style: { strokeWidth: 2 } }}
      >
        <Background />
        <MiniMap pannable zoomable />
        <Controls />
      </ReactFlow>

      {detailsOverlay}

      {/* 物品库选择弹窗 */}
      {iconPickerOpen && selectedId && (
        <div className="modal-mask" onClick={()=>setIconPickerOpen(false)}>
          <div className="modal" onClick={(e)=>e.stopPropagation()}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div style={{fontWeight:700}}>选择图标</div>
              <button className="btn ghost" onClick={()=>setIconPickerOpen(false)}>关闭</button>
            </div>
            <div style={{marginTop:8}}>
              <input className="inv-search" placeholder="搜索物品…" value={invQ} onChange={(e)=>{ setInvQ(e.target.value); loadInventory(e.target.value, invCat) }} />
              <div className="inv-cats" style={{marginTop:8}}>
                {defaultCats.map(c => (
                  <button key={c} className={'cat-btn ' + (c===invCat?'active':'')} onClick={()=>{ setInvCat(c); loadInventory(invQ, c) }}>{c}</button>
                ))}
              </div>

              <div className="drop-zone" 
                   onDragOver={(e)=>{ e.preventDefault(); e.dataTransfer.dropEffect='copy' }} 
                   onDrop={async (e)=>{ 
                     e.preventDefault(); 
                     const files = Array.from(e.dataTransfer.files || []);
                     for (const f of files) { 
                       try { 
                         const res = await uploadIcon(f as any); 
                         try {
                           await api.post('/api/items', { name: (f as any).name?.replace(/\.[^/.]+$/,''), category: 'Custom', icon_path: (res as any).icon_url });
                           await loadInventory();
                         } catch {
                           setInvItems((lst)=>[{ id: 'tmp_'+Date.now(), name: (f as any).name, icon_path: (res as any).icon_url }, ...lst] as any);
                         }
                       } catch (err) { console.error(err); alert('上传失败'); }
                     }
                   }}>
                把图片拖到此面板可直接上传为图标。
              </div>

              <div className="inv-grid" style={{marginTop:8, maxHeight: 360, overflow: 'auto'}}>
                {invItems.map(it => (
                  <div key={it.id} className="inv-item" onClick={()=>{
                    setNodes(nds => nds.map(n => n.id === selectedId ? ({ ...n, data: { ...n.data, icon: it.icon_path } }) : n) as any)
                    setIconPickerOpen(false)
                  }}>
                    {it.icon_path ? <img src={prefixUrl(it.icon_path)} /> : <div style={{height:48, display:'grid', placeItems:'center'}}>🧱</div>}
                    <div style={{fontSize: 12, marginTop: 6}}>{it.name}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
