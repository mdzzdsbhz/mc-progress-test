# MC 进度系统（Python + React WebUI）

一个模仿 MC 风格的“进度/任务/里程碑”编辑器：带图标的节点、连线、正交折线、自动布局、物品库拖拽到画布、物品库拖拽上传图标、搜索分类、详情开关、分叉/短横/独立层级一键生成、导出 PNG/SVG、JSON 场景存储等。

## 目录结构

```
mc-progress-webui/
├─ server/              # FastAPI 后端（SQLite）
│  ├─ main.py
│  ├─ requirements.txt
│  └─ uploads/          # 图标与导出 JSON 存放
└─ web/                 # React + Vite 前端（TypeScript）
   ├─ src/
   │  ├─ components/
   │  │  ├─ App.tsx
   │  │  ├─ Canvas.tsx
   │  │  ├─ Inventory.tsx
   │  │  ├─ Toolbar.tsx
   │  │  ├─ layout.ts
   │  │  └─ useGraphStore.ts
   │  ├─ assets/
   │  ├─ styles.css
   │  ├─ main.tsx
   │  └─ types.ts
   ├─ index.html
   ├─ package.json
   ├─ tsconfig.json
   └─ vite.config.ts
```

## 功能一览

- 画布：拖拽/框选/多选、连线、删除、改变连线指向、改变连线样式（直线/正交/圆角/贝塞尔）
- 物品库：分类快速切换、搜索，**支持把图片文件直接拖到物品库面板**上传为图标并入库
- 从物品库拖拽到画布生成节点；同一图标可用于多个节点，每个节点有独立的标题与详细信息
- 详情开关与“智能避让”策略：展开详情时可一键自动布局避免遮挡
- 一键生成：短横、分叉（×3 可改造）、独立层级（可设置深度与分支数，代码里参数可调）
- 自动布局：Dagre 布局，支持 LR/TB
- 导出：PNG/SVG（客户端直接导出）；后端导出场景 JSON
- 多场景：在工具栏切换/新建；场景图保存到后端（SQLite）

> 注：示例默认未包含 Minecraft 原版贴图，请通过**拖拽上传**自己的图标或使用开源素材。

## 本地运行

### 1) 后端（Python 3.10+）

```bash
cd server
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

后端将开放：
- `http://127.0.0.1:8000/api/items` 等 REST 接口
- `http://127.0.0.1:8000/uploads/...` 静态图标访问

### 2) 前端（Node 18+）

```bash
cd web
npm i
# 如后端不在本机或端口不同，可设置环境变量：
#   PowerShell: $env:VITE_API_BASE="http://127.0.0.1:8000"
#   Bash: export VITE_API_BASE="http://127.0.0.1:8000"
npm run dev
```

打开 `http://localhost:5173/`。

## 使用说明

- 物品库：
  - 搜索框 + 分类按钮筛选
  - 把任意**图片文件**拖到物品库区域，按提示命名和分类即可上传入库
  - 从物品库**拖拽**任意物品到画布，生成节点（每个节点都有独立的标题/详情，可二次编辑）

- 画布：
  - 单击节点：选中；拖拽连线点即可连接/改变指向
  - 顶部按钮：
    - 展开/折叠详细信息（MC 风格显示）
    - 自动布局（LR/TB）
    - 线条风格（直线/正交/圆角/贝塞尔）全局应用到现有连线
    - “短横”：从选中节点加一个短连接的小节点
    - “分叉×3”：从选中节点生成三个子节点并连线
    - “独立层级”：生成一个 3x3 的树状结构
    - 导出 PNG/SVG
  - 删除：选中后按 <Delete>/<Backspace>
  - 撤销/重做：使用浏览器/系统快捷键（Ctrl/Cmd+Z / Ctrl/Cmd+Y）

- 场景：工具栏左侧选择或新建；“保存到后端”会把当前画布写入 SQLite。

## 二次开发提示

- 线条样式为每条 Edge 的 `type` 字段（`default`/`step`/`smoothstep`/`bezier`）；可拓展自定义 EdgeType。
- 若需要“标签智能避让”，建议在展开详情后触发一次 `applyDagreLayout`，并按节点 `data.showDetails` 调整节点宽高（已演示）。
- 可在 `Canvas.tsx` 的 `generateHierarchy` 与 `addFork` 中自定义生成规则。
- 若需要多人协作/实时同步，可在后端加入 WebSocket 广播，前端使用 `onNodesChange`/`onEdgesChange` 增量同步。

## 许可证

此模板仅为演示；你需要确保自己的图标素材具备相应授权。

祝创作愉快！
