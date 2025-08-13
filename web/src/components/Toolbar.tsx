import React, { useRef } from 'react'
import { exportSceneZip, importSceneZip } from './api'

export default function Toolbar({
  scenes, sceneId, onSceneChange, onCreateScene, onRenameScene, onDeleteScene, onSave, saving
}: {
  scenes: {id:number; name:string}[]
  sceneId: number|null
  onSceneChange: (id:number)=>void
  onCreateScene: ()=>void
  onRenameScene: (id:number, name:string)=>void
  onDeleteScene: (id:number, name:string)=>void
  onSave: ()=>void
  saving: boolean
}) {
  const currentScene = sceneId ? scenes.find(s => s.id === sceneId) : null
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleExportZip() {
    if (!currentScene) {
      alert('请先选择一个场景再导出')
      return
    }
    try {
      const blob = await exportSceneZip(currentScene.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `scene_${currentScene.id}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
      alert('导出失败')
    }
  }

  async function handleImportZipChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const res = await importSceneZip(file)
      // 这里先给出提示；父组件若需要自动切换到新场景，请在父组件导入后刷新场景列表并 setSceneId(res.scene_id)
      alert(`导入成功，新场景ID：${res.scene_id}。请刷新场景列表后切换到该场景。`)
    } catch (e) {
      console.error(e)
      alert('导入失败')
    } finally {
      // 允许选择同一个文件二次触发
      e.currentTarget.value = ''
    }
  }

  return (
    <div className="toolbar">
      <div style={{fontWeight: 700}}>MC 进度系统 WebUI</div>
      <div className="sep"></div>

      <span>场景：</span>
      <select className="btn" value={sceneId ?? ''} onChange={e => onSceneChange(Number(e.target.value))}>
        {scenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <button className="btn" onClick={onCreateScene}>新建场景</button>
      <button className="btn" onClick={() => currentScene && onRenameScene(currentScene.id, currentScene.name)} disabled={!currentScene}>重命名</button>
      <button className="btn" onClick={() => currentScene && onDeleteScene(currentScene.id, currentScene.name)} disabled={!currentScene}>删除</button>

      <div className="sep"></div>
      <button className="btn primary" onClick={onSave} disabled={saving}>
        {saving ? '保存中…' : '保存到后端'}
      </button>

      <div className="sep"></div>
      <button className="btn" onClick={handleExportZip} disabled={!currentScene}>导出ZIP</button>
      <button className="btn" onClick={() => fileRef.current?.click()}>导入ZIP</button>
      <input
        ref={fileRef}
        type="file"
        accept=".zip"
        style={{ display: 'none' }}
        onChange={handleImportZipChange}
      />

      <div className="sep"></div>
      <div style={{fontSize: 12, color: '#6b7280'}}>
        快捷键：<span className="kbd">Delete</span> 删除、鼠标框选、多选拖拽、拖线改变指向
      </div>
    </div>
  )
}
