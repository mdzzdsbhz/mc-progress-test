
import os
import sqlite3
import json
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))
FRONTEND_DIR = os.path.join(ROOT, "frontend")
STATIC_DIR = os.path.join(FRONTEND_DIR, "static")
UPLOADS_DIR = os.path.join(STATIC_DIR, "uploads")
DB_PATH = os.path.join(ROOT, "app.db")

os.makedirs(UPLOADS_DIR, exist_ok=True)

def get_conn():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_conn()
    cur = conn.cursor()
    # categories
    cur.execute("""
    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
    )
    """)
    # items
    cur.execute("""
    CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT DEFAULT 'General',
        tags TEXT DEFAULT '',
        icon_path TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """)
    # graphs
    cur.execute("""
    CREATE TABLE IF NOT EXISTS graphs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """)
    # seed categories
    cur.execute("SELECT COUNT(1) c FROM categories")
    if cur.fetchone()["c"] == 0:
        for n in ["General", "资源", "工具", "知识"]:
            cur.execute("INSERT INTO categories(name, created_at) VALUES (?, ?)", (n, datetime.utcnow().isoformat()))
    # seed a default graph
    cur.execute("SELECT COUNT(1) as c FROM graphs")
    if cur.fetchone()["c"] == 0:
        cur.execute(
            "INSERT INTO graphs(name, data, updated_at) VALUES (?, ?, ?)",
            ("default", json.dumps({"cells": []}), datetime.utcnow().isoformat())
        )
    conn.commit()
    conn.close()

app = FastAPI(title="MC Progress (AntV X6) — Single Process")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/", response_class=HTMLResponse)
def index():
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    with open(index_path, "r", encoding="utf-8") as f:
        return HTMLResponse(f.read())

# ---------------- Categories ----------------
@app.get("/api/categories")
def list_categories():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, name, created_at FROM categories ORDER BY name COLLATE NOCASE")
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return {"categories": rows}

@app.post("/api/categories")
def create_category(name: str = Form(...)):
    name = (name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="分类名不能为空")
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute("INSERT INTO categories(name, created_at) VALUES (?, ?)", (name, datetime.utcnow().isoformat()))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="分类已存在")
    conn.close()
    return {"ok": True}

@app.delete("/api/categories/{cat_id}")

@app.patch("/api/categories/{cat_id}")
def rename_category(cat_id: int, name: str = Form(...)):
    name = (name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="分类名不能为空")
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT name FROM categories WHERE id=?", (cat_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="分类不存在")
    old = row["name"]
    try:
        cur.execute("UPDATE categories SET name=? WHERE id=?", (name, cat_id))
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="分类已存在")
    cur.execute("UPDATE items SET category=? WHERE category=?", (name, old))
    conn.commit()
    conn.close()
    return {"ok": True}

@app.patch("/api/items/{item_id}")
def patch_item(item_id: int, name: str = Form(None), category: str = Form(None)):
    if name is None and category is None:
        raise HTTPException(status_code=400, detail="no changes")
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM items WHERE id=?", (item_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="not found")
    new_name = name if name is not None else row["name"]
    new_cat = category if category is not None else row["category"]
    cur.execute("UPDATE items SET name=?, category=? WHERE id=?", (new_name, new_cat, item_id))
    conn.commit()
    conn.close()
    return {"ok": True}

def delete_category(cat_id: int):
    conn = get_conn()
    cur = conn.cursor()
    # find name
    cur.execute("SELECT name FROM categories WHERE id=?", (cat_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="分类不存在")
    name = row["name"]
    # reassign items to General
    cur.execute("UPDATE items SET category='General' WHERE category=?", (name,))
    cur.execute("DELETE FROM categories WHERE id=?", (cat_id,))
    conn.commit()
    conn.close()
    return {"ok": True}

# ---------------- Items (Library) ----------------
@app.get("/api/items")
def api_items(search: str = "", category: str = ""):
    conn = get_conn()
    cur = conn.cursor()
    q = "SELECT * FROM items WHERE 1=1"
    params = []
    if search:
        q += " AND (name LIKE ? OR tags LIKE ?)"
        like = f"%{search}%"
        params.extend([like, like])
    if category:
        q += " AND category = ?"
        params.append(category)
    q += " ORDER BY created_at DESC"
    cur.execute(q, params)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return {"items": rows}

@app.post("/api/items")
def create_item(name: str = Form(...), category: str = Form("General"), tags: str = Form(""), icon_url: str = Form(...)):
    import base64, requests
    icon_rel_path = None
    if icon_url.startswith("data:image"):
        header, b64data = icon_url.split(",", 1)
        ext = "png"
        if "image/svg+xml" in header: ext = "svg"
        elif "image/jpeg" in header: ext = "jpg"
        filename = f"{datetime.utcnow().timestamp():.0f}_{name}.{ext}"
        abspath = os.path.join(UPLOADS_DIR, filename)
        with open(abspath, "wb") as f:
            f.write(base64.b64decode(b64data))
        icon_rel_path = f"/static/uploads/{filename}"
    elif icon_url.startswith("http"):
        r = requests.get(icon_url, timeout=10)
        if r.status_code != 200:
            raise HTTPException(status_code=400, detail="图标拉取失败")
        filename = f"{datetime.utcnow().timestamp():.0f}_{name}.png"
        abspath = os.path.join(UPLOADS_DIR, filename)
        with open(abspath, "wb") as f:
            f.write(r.content)
        icon_rel_path = f"/static/uploads/{filename}"
    else:
        raise HTTPException(status_code=400, detail="icon_url 必须是 data URI 或 http(s) URL")
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO items(name, category, tags, icon_path, created_at) VALUES (?, ?, ?, ?, ?)",
        (name, category, tags, icon_rel_path, datetime.utcnow().isoformat()),
    )
    item_id = cur.lastrowid
    conn.commit()
    conn.close()
    return {"ok": True, "id": item_id, "icon_path": icon_rel_path}

@app.post("/api/items/upload")
async def upload_items(files: list[UploadFile] = File(...), category: str = Form("General")):
    saved = []
    for file in files:
        filename = f"{datetime.utcnow().timestamp():.0f}_{file.filename}"
        dst = os.path.join(UPLOADS_DIR, filename)
        content = await file.read()
        with open(dst, "wb") as f:
            f.write(content)
        rel = f"/static/uploads/{filename}"
        name = os.path.splitext(file.filename)[0]
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO items(name, category, tags, icon_path, created_at) VALUES (?, ?, ?, ?, ?)",
            (name, category, "", rel, datetime.utcnow().isoformat()),
        )
        item_id = cur.lastrowid
        conn.commit()
        conn.close()
        saved.append({"id": item_id, "name": name, "category": category, "icon_path": rel})
    return {"ok": True, "items": saved}

@app.delete("/api/items/{item_id}")
def delete_item(item_id: int):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT icon_path FROM items WHERE id=?", (item_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="not found")
    icon_path = row["icon_path"]
    cur.execute("DELETE FROM items WHERE id=?", (item_id,))
    conn.commit()
    conn.close()
    if icon_path and icon_path.startswith("/static/uploads/"):
        abspath = os.path.join(ROOT, icon_path.lstrip("/"))
        if os.path.exists(abspath):
            try:
                os.remove(abspath)
            except Exception:
                pass
    return {"ok": True}

# ---------------- Graphs ----------------
@app.get("/api/graphs")
def list_graphs():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, name, updated_at FROM graphs ORDER BY updated_at DESC")
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return {"graphs": rows}

@app.post("/api/graphs")
def create_graph(name: str = Form(...)):
    data = {"nodes": [], "edges": []}
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO graphs(name, data, updated_at) VALUES (?, ?, ?)",
        (name, json.dumps(data), datetime.utcnow().isoformat()),
    )
    gid = cur.lastrowid
    conn.commit()
    conn.close()
    return {"ok": True, "id": gid}

@app.get("/api/graphs/{graph_id}")
def get_graph(graph_id: int):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, name, data, updated_at FROM graphs WHERE id=?", (graph_id,))
    row = cur.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="not found")
    return {"id": row["id"], "name": row["name"], "data": json.loads(row["data"]), "updated_at": row["updated_at"]}

@app.post("/api/graphs/{graph_id}")

async def save_graph(graph_id: int, request: Request):
    payload = await request.json()
    # Accept X6 JSON ({cells: [...]}) primarily; backward-compat for {nodes, edges}
    if "cells" in payload and isinstance(payload["cells"], list):
        data_to_store = {"cells": payload["cells"]}
    elif "nodes" in payload and "edges" in payload:
        try:
            cells = []
            for n in payload.get("nodes", []):
                cells.append({"shape": "rect", "id": n.get("id"), "position": {"x": n.get("x", 0), "y": n.get("y", 0)}, "size": {"width": n.get("width", 80), "height": n.get("height", 60)}})
            for e in payload.get("edges", []):
                src = e.get("source"); tgt = e.get("target")
                if isinstance(src, dict): src = src.get("cell")
                if isinstance(tgt, dict): tgt = tgt.get("cell")
                cells.append({"shape": "edge", "source": src, "target": tgt})
            data_to_store = {"cells": cells}
        except Exception:
            raise HTTPException(status_code=400, detail="invalid graph")
    else:
        raise HTTPException(status_code=400, detail="invalid graph")
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("UPDATE graphs SET data=?, updated_at=? WHERE id=?",
                (json.dumps(data_to_store), datetime.utcnow().isoformat(), graph_id))
    if cur.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="not found")
    conn.commit()
    conn.close()
    return {"ok": True}

@app.get("/{path:path}", response_class=HTMLResponse)
def catch_all(path: str):
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    with open(index_path, "r", encoding="utf-8") as f:
        return HTMLResponse(f.read())
