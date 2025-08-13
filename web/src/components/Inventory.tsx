import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { Item } from '../types'
import debounce from 'lodash.debounce'
import classNames from 'classnames'
import {
  listItems, uploadIcon, updateItem, deleteItem, API_BASE, api,
  listCategories, createCategory, deleteCategory
} from './api'

const DEFAULT_CATS = ['All', 'Blocks', 'Ores', 'Tools', 'Food', 'Mobs', 'Custom'] as const
const RESERVED = new Set(DEFAULT_CATS)

export default function Inventory() {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('All')
  const [items, setItems] = useState<Item[]>([])
  const [hoveredItemId, setHoveredItemId] = useState<number | null>(null)
  const [customCats, setCustomCats] = useState<string[]>([])

  const allCats = useMemo(
    () => [...DEFAULT_CATS, ...customCats.filter(c => !RESERVED.has(c))],
    [customCats]
  )

  const refresh = useCallback(async (qv?: string, cv?: string) => {
    const category = cv ?? cat
    const [data, fetchedCats] = await Promise.all([
      listItems({ q: qv ?? q, category }),
      listCategories()
    ])
    setItems(data)
    setCustomCats(Array.isArray(fetchedCats) ? fetchedCats : [])
  }, [q, cat])

  useEffect(() => { refresh() }, [refresh])

  const debounced = useCallback(
    debounce((v: string, currentCat: string) => refresh(v, currentCat), 300),
    [refresh]
  )
  useEffect(() => () => debounced.cancel(), [debounced])

  function onDragStart(ev: React.DragEvent, it: Item) {
    ev.dataTransfer.setData('application/x-inventory-item', JSON.stringify(it))
    ev.dataTransfer.effectAllowed = 'copy'
  }

  async function handleDropUpload(ev: React.DragEvent<HTMLDivElement>) {
    ev.preventDefault()
    const files = Array.from(ev.dataTransfer.files || [])
    for (const f of files) {
      try {
        const defaultName = f.name.replace(/\.[^/.]+$/, '')
        const defaultCategory = 'Custom'
        const res = await uploadIcon(f as any, { name: defaultName, category: defaultCategory })
        if (!res.item) {
          await api.post('/api/items', {
            name: defaultName, category: defaultCategory, icon_path: res.icon_url
          })
        }
        await refresh()
      } catch (err) {
        console.error(err)
        alert('上传失败')
      }
    }
  }

  async function onRenameItem(item: Item) {
    const newName = prompt(`重命名 "${item.name}" 为:`, item.name)
    if (newName && newName !== item.name) {
      await updateItem(item.id, { name: newName })
      await refresh()
    }
  }

  async function onDeleteItem(item: Item) {
    if (confirm(`确定要删除物品 "${item.name}" 吗？`)) {
      await deleteItem(item.id)
      await refresh()
    }
  }

  async function handleCategoryDrop(ev: React.DragEvent, targetCategory: string) {
    ev.preventDefault()
    const itemData = ev.dataTransfer.getData('application/x-inventory-item')
    if (!itemData) return
    try {
      const item = JSON.parse(itemData)
      if (item.id) {
        await updateItem(item.id, { category: targetCategory })
        await refresh()
      }
    } catch (err) {
      console.error(err)
      alert('更新物品分类失败')
    }
  }

  async function onAddCategory() {
    const name = (prompt('新分类名称：') || '').trim()
    if (!name) return
    if (RESERVED.has(name)) { alert('该名称为系统保留分类'); return }
    try {
      await createCategory(name)
      setCat(name)
      await refresh(q, name)
    } catch (err) {
      console.error(err)
      alert('添加分类失败')
    }
  }

  async function onDeleteCategory(catToDelete: string) {
    if (!catToDelete || RESERVED.has(catToDelete)) return
    if (confirm(`确定要删除分类 "${catToDelete}" 吗？该分类下的物品将被移至 "Custom"。`)) {
      try {
        await deleteCategory(catToDelete)
        const nextCat = cat === catToDelete ? 'Custom' : cat
        setCat(nextCat)
        await refresh(q, nextCat)
      } catch (err) {
        console.error(err)
        alert('删除分类失败')
      }
    }
  }

  return (
    <div>
      <input
        className="inv-search"
        placeholder="搜索物品…"
        value={q}
        onChange={(e) => { setQ(e.target.value); debounced(e.target.value, cat) }}
      />

      <div className="inv-cats">
        {allCats.map(c => (
          <button
            key={c}
            className={classNames('cat-btn', { active: c === cat })}
            onClick={() => { setCat(c); refresh(q, c) }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
            onDrop={(e) => handleCategoryDrop(e, c)}
            style={{ position: 'relative' }}
          >
            {c}
            {/* 仅自定义分类显示删除按钮 */}
            {!RESERVED.has(c as any) && (
              <span
                role="button"
                className="btn-icon"
                onClick={(e) => { e.stopPropagation(); onDeleteCategory(c) }}
                title="删除分类"
                style={{ marginLeft: 6 }}
              >🗑️</span>
            )}
          </button>
        ))}
        <button className="cat-btn" onClick={onAddCategory}>+ 新分类</button>
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
            {it.icon_path
              ? <img src={API_BASE ? `${API_BASE}${it.icon_path}` : it.icon_path} />
              : <div style={{ height: 48, display: 'grid', placeItems: 'center' }}>🧱</div>}
            <div style={{ fontSize: 12, marginTop: 6 }}>{it.name}</div>
            {hoveredItemId === it.id && (
              <div className="item-actions">
                <button className="btn-icon" onClick={(e) => { e.stopPropagation(); onRenameItem(it) }}>✏️</button>
                <button className="btn-icon" onClick={(e) => { e.stopPropagation(); onDeleteItem(it) }}>🗑️</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div
        className="drop-zone"
        onDragOver={(e)=>{e.preventDefault(); e.dataTransfer.dropEffect='copy'}}
        onDrop={handleDropUpload}
        style={{ marginTop: 8 }}
      >
        把图片拖到此面板可直接上传为图标。
      </div>
    </div>
  )
}
