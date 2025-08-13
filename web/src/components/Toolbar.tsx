import React from 'react'

export default function Toolbar({ scenes, sceneId, onSceneChange, onCreateScene, onRenameScene, onDeleteScene, onSave, saving }:
  { scenes: {id:number; name:string}[], sceneId: number|null, onSceneChange: (id:number)=>void, onCreateScene: ()=>void, onRenameScene: (id:number, name:string)=>void, onDeleteScene: (id:number, name:string)=>void, onSave: ()=>void, saving: boolean }) {
  const currentScene = sceneId ? scenes.find(s => s.id === sceneId) : null

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
      <button className="btn primary" onClick={onSave} disabled={saving}>{saving ? '保存中…' : '保存到后端'}</button>
      <div className="sep"></div>
      <div style={{fontSize: 12, color: '#6b7280'}}>快捷键：<span className="kbd">Delete</span> 删除、鼠标框选、多选拖拽、拖线改变指向</div>
    </div>
  )
}