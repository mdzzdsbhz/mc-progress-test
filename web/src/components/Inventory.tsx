import React, { useEffect, useState, useCallback } from 'react'
import { Item } from '../types'
import debounce from 'lodash.debounce'
import classNames from 'classnames'
import { listItems, uploadIcon, updateItem, deleteItem, API_BASE, api } from './api'

const defaultCats = ['All', 'Blocks', 'Ores', 'Tools', 'Food', 'Mobs', 'Custom']

export default function Inventory() {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('All')
  const [items, setItems] = useState<Item[]>([])
  const [hoveredItemId, setHoveredItemId] = useState<number | null>(null)

  const fetch = useCallback(async (qv?: string, cv?: string) => {
    const data = await listItems({ q: qv || q, category: cv || cat })
    setItems(data)
  }, [q, cat])

  useEffect(() => { fetch() }, [])

  const debounced = useCallback(debounce((v: string) => fetch(v, cat), 300), [cat])

  function onDragStart(ev: React.DragEvent, it: Item) {
    ev.dataTransfer.setData('application/x-inventory-item', JSON.stringify(it))
    ev.dataTransfer.effectAllowed = 'copy'
  }

  async function handleDropUpload(ev: React.DragEvent<HTMLDivElement>) {
    ev.preventDefault()
    const file = ev.dataTransfer.files?.[0]
    if (!file) return
    const name = prompt('为这个图标起个名字？') || file.name
    const catName = prompt(`分类？（默认 Custom，可选: ${defaultCats.join(', ')}）`) || 'Custom'
    await uploadIcon(file, { name, category: catName })
    await fetch()
  }

  async function onRenameItem(item: Item) {
    const newName = prompt(`重命名 "${item.name}" 为:`, item.name)
    if (newName && newName !== item.name) {
      await updateItem(item.id, { name: newName })
      await fetch()
    }
  }

  async function onDeleteItem(item: Item) {
    if (confirm(`确定要删除物品 "${item.name}" 吗？`)) {
      await deleteItem(item.id)
      await fetch()
    }
  }

  return (
    <div onDragOver={(e)=>e.preventDefault()} onDrop={handleDropUpload}>
      <input className="inv-search" placeholder="搜索物品…" value={q} onChange={(e) => { setQ(e.target.value); debounced(e.target.value) }} />
      <div className="inv-cats">
        {defaultCats.map(c => (
          <button key={c} className={classNames('cat-btn', { active: c === cat })} onClick={() => { setCat(c); fetch(q, c) }}>{c}</button>
        ))}
      </div>
      <div className="inv-grid">
        {items.map(it => (
          <div
            key={it.id}
            className="inv-item"
            draggable
            onDragStart={(e) => onDragStart(e, it)}
            title={it.description || it.name}
            onMouseEnter={() => setHoveredItemId(it.id)}
            onMouseLeave={() => setHoveredItemId(null)}
          >
            {it.icon_path ? <img src={API_BASE ? `${API_BASE}${it.icon_path}` : it.icon_path} /> : <div style={{height:48, display:'grid', placeItems:'center'}}>🧱</div>}
            <div style={{fontSize: 12, marginTop: 6}}>{it.name}</div>
            {hoveredItemId === it.id && (
              <div className="item-actions">
                <button className="btn-icon" onClick={(e) => { e.stopPropagation(); onRenameItem(it); }}>✏️</button>
                <button className="btn-icon" onClick={(e) => { e.stopPropagation(); onDeleteItem(it); }}>🗑️</button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{marginTop: 8, fontSize: 12, color: '#6b7280'}}>把图片拖到此面板可直接上传为图标。</div>
    </div>
  )
}
