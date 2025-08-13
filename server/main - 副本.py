from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlmodel import SQLModel, Field, Session, create_engine, select
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from datetime import datetime
import os, shutil, uuid, json

DB_URL = "sqlite:///./mcprogress.db"
engine = create_engine(DB_URL, echo=False)

class Item(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    category: str = "Custom"
    description: str = ""
    icon_path: str = ""   # served from /uploads
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Scene(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = "Default"
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CustomCategory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Graph(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    scene_id: int = Field(index=True)
    json: str = "{}"
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ItemCreate(BaseModel):
    name: str
    category: str = "Custom"
    description: str = ""
    icon_path: str = ""

class ItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    icon_path: Optional[str] = None

class ItemOut(BaseModel):
    id: int
    name: str
    category: str
    description: str
    icon_path: str
    created_at: datetime
    class Config:
        from_attributes = True

class SceneOut(BaseModel):
    id: int
    name: str
    created_at: datetime
    class Config:
        orm_mode = True

class GraphIn(BaseModel):
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    meta: Dict[str, Any] = {}

class GraphOut(GraphIn):
    scene_id: int
    updated_at: datetime

app = FastAPI(title="MC Progress System API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

def init_db():
    SQLModel.metadata.create_all(engine)
    # Seed default scene and a few starter items if empty
    with Session(engine) as s:
        if not s.exec(select(Scene)).first():
            sc = Scene(name="Default")
            s.add(sc)
        if not s.exec(select(Item)).first():
            # Minimal neutral icons (emoji-like as placeholders)
            base_items = [
                {"name": "Stone", "category": "Blocks", "description": "Basic block", "icon_path": ""},
                {"name": "Iron Ore", "category": "Ores", "description": "Smelt to get iron", "icon_path": ""},
                {"name": "Pickaxe", "category": "Tools", "description": "Mining tool", "icon_path": ""},
                {"name": "Bread", "category": "Food", "description": "Tasty loaf", "icon_path": ""},
                {"name": "Creeper", "category": "Mobs", "description": "Hiss...", "icon_path": ""},
            ]
            for it in base_items:
                s.add(Item(**it))
        s.commit()

@app.on_event("startup")
def on_start():
    init_db()

@app.get("/api/items", response_model=List[ItemOut])
def list_items(q: Optional[str] = None, category: Optional[str] = None):
    with Session(engine) as s:
        stmt = select(Item)
        if q:
            like = f"%{q}%"
            stmt = stmt.where((Item.name.ilike(like)) | (Item.description.ilike(like)) | (Item.category.ilike(like)))
        if category and category != "All":
            stmt = stmt.where(Item.category == category)
        stmt = stmt.order_by(Item.created_at.desc())
        return s.exec(stmt).all()

@app.post("/api/items", response_model=ItemOut)
def create_item(payload: ItemCreate):
    with Session(engine) as s:
        item = Item(**payload.dict())
        s.add(item)
        s.commit()
        s.refresh(item)
        return item

@app.put("/api/items/{item_id}", response_model=ItemOut)
def update_item(item_id: int, payload: ItemUpdate):
    with Session(engine) as s:
        item = s.get(Item, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        for k, v in payload.dict(exclude_unset=True).items():
            setattr(item, k, v)
        s.add(item)
        s.commit()
        s.refresh(item)
        return item

@app.delete("/api/items/{item_id}")
def delete_item(item_id: int):
    with Session(engine) as s:
        item = s.get(Item, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        # Optionally remove icon file
        if item.icon_path and os.path.exists(item.icon_path.strip("/")):
            try:
                os.remove(item.icon_path.strip("/"))
            except Exception:
                pass
        s.delete(item)
        s.commit()
        return {"ok": True}

class CategoryCreate(BaseModel):
    name: str

@app.get("/api/categories", response_model=List[str])
def list_custom_categories():
    with Session(engine) as s:
        categories = s.exec(select(CustomCategory)).all()
        return [c.name for c in categories]

@app.post("/api/categories", response_model=str)
def create_custom_category(payload: CategoryCreate):
    with Session(engine) as s:
        if s.exec(select(CustomCategory).where(CustomCategory.name == payload.name)).first():
            raise HTTPException(status_code=400, detail="Category already exists")
        category = CustomCategory(name=payload.name)
        s.add(category)
        s.commit()
        s.refresh(category)
        return category.name

@app.delete("/api/categories/{category_name}")
def delete_custom_category(category_name: str):
    with Session(engine) as s:
        category = s.exec(select(CustomCategory).where(CustomCategory.name == category_name)).first()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")

        # Reassign items in this category to "Custom"
        items_to_reassign = s.exec(select(Item).where(Item.category == category_name)).all()
        for item in items_to_reassign:
            item.category = "Custom" # Or another default category
            s.add(item)

        s.delete(category)
        s.commit()
        return {"ok": True}

@app.post("/api/upload")
def upload_icon(file: UploadFile = File(...), name: Optional[str] = Form(None), category: Optional[str] = Form("Custom"), description: Optional[str] = Form("")):
    ext = os.path.splitext(file.filename)[-1].lower()
    if ext not in [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    newname = f"{uuid.uuid4().hex}{ext}"
    dest = os.path.join("uploads", newname)
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    icon_url = f"/uploads/{newname}"
    if name:
        # create an item tied to this icon
        with Session(engine) as s:
            item = Item(name=name, category=category or "Custom", description=description or "", icon_path=icon_url)
            s.add(item)
            s.commit()
            s.refresh(item)
            return {"icon_url": icon_url, "item": ItemOut.from_orm(item)}
    return {"icon_url": icon_url}

@app.get("/api/scenes", response_model=List[SceneOut])
def list_scenes():
    with Session(engine) as s:
        return s.exec(select(Scene).order_by(Scene.created_at.desc())).all()

class SceneCreate(BaseModel):
    name: str

@app.post("/api/scenes", response_model=SceneOut)
def create_scene(payload: SceneCreate):
    with Session(engine) as s:
        if s.exec(select(Scene).where(Scene.name == payload.name)).first():
            raise HTTPException(status_code=400, detail="Scene name already exists")
        sc = Scene(name=payload.name)
        s.add(sc)
        s.commit()
        s.refresh(sc)
        return sc

class SceneUpdate(BaseModel):
    name: str

@app.put("/api/scenes/{scene_id}", response_model=SceneOut)
def update_scene(scene_id: int, payload: SceneUpdate):
    with Session(engine) as s:
        scene = _get_scene_or_404(s, scene_id)
        if s.exec(select(Scene).where(Scene.name == payload.name).where(Scene.id != scene_id)).first():
            raise HTTPException(status_code=400, detail="Scene name already exists")
        scene.name = payload.name
        s.add(scene)
        s.commit()
        s.refresh(scene)
        return scene

@app.delete("/api/scenes/{scene_id}")
def delete_scene(scene_id: int):
    with Session(engine) as s:
        scene = _get_scene_or_404(s, scene_id)
        # Delete associated graph
        graph = s.exec(select(Graph).where(Graph.scene_id == scene_id)).first()
        if graph:
            s.delete(graph)
        s.delete(scene)
        s.commit()
        return {"ok": True}

def _get_scene_or_404(s: Session, scene_id: int) -> Scene:
    sc = s.get(Scene, scene_id)
    if not sc:
        raise HTTPException(status_code=404, detail="Scene not found")
    return sc

@app.get("/api/scenes/{scene_id}/graph", response_model=GraphOut)
def get_graph(scene_id: int):
    with Session(engine) as s:
        _get_scene_or_404(s, scene_id)
        g = s.exec(select(Graph).where(Graph.scene_id == scene_id)).first()
        if not g:
            g = Graph(scene_id=scene_id, json=json.dumps({"nodes": [], "edges": [], "meta": {}}))
            s.add(g); s.commit(); s.refresh(g)
        data = json.loads(g.json)
        return GraphOut(scene_id=scene_id, updated_at=g.updated_at, **data)

@app.put("/api/scenes/{scene_id}/graph", response_model=GraphOut)
def put_graph(scene_id: int, payload: GraphIn):
    with Session(engine) as s:
        _get_scene_or_404(s, scene_id)
        g = s.exec(select(Graph).where(Graph.scene_id == scene_id)).first()
        if not g:
            g = Graph(scene_id=scene_id)
        g.json = json.dumps(payload.dict())
        g.updated_at = datetime.utcnow()
        s.add(g); s.commit(); s.refresh(g)
        data = json.loads(g.json)
        return GraphOut(scene_id=scene_id, updated_at=g.updated_at, **data)

@app.get("/api/edge-styles")
def edge_styles():
    return [
        {"id": "default", "label": "Straight"},
        {"id": "step", "label": "Orthogonal (Step)"},
        {"id": "smoothstep", "label": "Smooth Step"},
        {"id": "bezier", "label": "Bezier"},
    ]

@app.get("/api/export/scene/{scene_id}.json")
def export_scene_json(scene_id: int):
    with Session(engine) as s:
        g = s.exec(select(Graph).where(Graph.scene_id == scene_id)).first()
        if not g:
            raise HTTPException(status_code=404, detail="Graph not found")
        path = f"uploads/scene_{scene_id}.json"
        with open(path, "w", encoding="utf-8") as f:
            f.write(g.json)
        return FileResponse(path, filename=os.path.basename(path), media_type="application/json")
