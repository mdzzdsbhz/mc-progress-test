import React, { useEffect, useMemo, useState } from 'react'
import Inventory from './Inventory'
import Canvas from './Canvas'
import Toolbar from './Toolbar'
import { listScenes, createScene, updateScene, deleteScene, getGraph, saveGraph } from './api'

type Scene = { id: number; name: string }

export default function App() {
  const [scenes, setScenes] = useState<Scene[]>([])
  const [sceneId, setSceneId] = useState<number | null>(null)
  const [pending, setPending] = useState(false)
  const [graph, setGraph] = useState<any>({ nodes: [], edges: [], meta: {} })

  useEffect(() => {
    (async () => {
      const s = await listScenes()
      setScenes(s)
      if (s.length) setSceneId(s[0].id)
    })()
  }, [])

  useEffect(() => {
    if (sceneId == null) return
    ;(async () => {
      const g = await getGraph(sceneId)
      setGraph(g)
    })()
  }, [sceneId])

  async function onSave(g: any) {
    if (sceneId == null) return
    setPending(true)
    try {
      const res = await saveGraph(sceneId, g)
      setGraph(res)
    } finally {
      setPending(false)
    }
  }

  async function onCreateScene() {
    const name = prompt('新建场景名称？')
    if (!name) return
    const s = await createScene(name)
    const all = await listScenes()
    setScenes(all)
    setSceneId(s.id)
  }

  async function onRenameScene(id: number, currentName: string) {
    const newName = prompt(`重命名场景 "${currentName}" 为:`, currentName)
    if (newName && newName !== currentName) {
      try {
        await updateScene(id, { name: newName })
        const all = await listScenes()
        setScenes(all)
      } catch (error) {
        console.error("重命名场景失败:", error)
        alert("重命名场景失败，请稍后再试。")
      }
    }
  }

  async function onDeleteScene(id: number, name: string) {
    if (confirm(`确定要删除场景 "${name}" 吗？`)) {
      try {
        await deleteScene(id)
        const all = await listScenes()
        setScenes(all)
        if (id === sceneId) {
          // If the deleted scene was the active one, switch to the first available scene or null
          setSceneId(all.length > 0 ? all[0].id : null)
        }
      } catch (error) {
        console.error("删除场景失败:", error)
        alert("删除场景失败，请稍后再试。")
      }
    }
  }

  return (
    <div className="app-shell">
      <Toolbar
        scenes={scenes}
        sceneId={sceneId}
        onSceneChange={(id) => setSceneId(id)}
        onCreateScene={onCreateScene}
        onRenameScene={onRenameScene}
        onDeleteScene={onDeleteScene}
        onSave={() => onSave(graph)}
        saving={pending}
      />
      <div className="layout">
        <div className="sidebar">
          <Inventory />
          <div style={{marginTop: 12, fontSize: 12, color: '#6b7280'}}>
            提示：支持把图片文件直接拖到物品库面板，自动上传为图标。
          </div>
        </div>
        <div className="canvas-wrap">
          <Canvas
            key={sceneId ?? 0}
            initialGraph={graph}
            onGraphChange={(g) => setGraph(g)}
          />
        </div>
      </div>
    </div>
  )
}
