
# MC 风单进程进度系统（Python + AntV X6 + Web UI）

**本版本新增**：
- ✅ 明确的 **“选择图片”上传按钮**（多图上传）
- ✅ 支持 **将图片拖拽到“上传区域”或直接拖拽到物品库列表** 进行上传
- ✅ **自定义分类**：新增/删除分类接口与 UI，上传时按当前筛选分类归档
- ✅ `requirements.txt` 加入 `requests`，兼容 URL 图标导入

## 运行
```bash
pip install -r requirements.txt
python -m uvicorn backend.main:app --reload
# 浏览器打开 http://127.0.0.1:8000/
```

## 物品库与分类
- 顶部有：搜索、分类筛选、**新建分类**、**选择图片（多选）**。
- 拖拽图片到：
  - **上传区域**（白框）
  - 或**直接拖到物品库列表区域**（更自然的操作）
- 上传会保存到当前筛选分类；如果筛选为“全部”，则默认归类到 `General`。

## 其他主要功能
- 从物品库拖拽图标到画布创建节点；节点可独立编辑详细信息（不会写死）。
- 边：自由连/删/改指向；切换样式（正交/直线/折线/贝塞尔）。
- 自动布局（Dagre）+ 详情展开智能避让（可开关）。
- 一键生成：短横/分叉/独立层级。
- 撤销/重做、框选/多选、复制/粘贴、导出 PNG。
- 图谱保存/加载（SQLite）。

## API（节选）
- `GET /api/categories` 列出分类
- `POST /api/categories` 新建分类（表单字段 `name`）
- `DELETE /api/categories/{id}` 删除分类（其下物品归类为 `General`）
- `POST /api/items/upload` 多图上传（表单 `files[]` + `category`）

祝你搭图顺滑！


> 如果左侧按钮也失效，多半是 X6 CDN 未加载导致脚本在初始化时报错。v3 已在脚本中做了防护，左侧功能会正常，状态栏会提示。


## v5（本地 UMD）
- 页面改为加载 **本地** `/static/libs/x6.js` 与 `/static/libs/layout.min.js`，彻底摆脱 CDN。
- 首次运行若没有真实库，已内置 **STUB**（占位），左侧功能可用但画布不渲染。
- 一次性安装真实库：
  ```bash
  python scripts/bootstrap_libs.py
  # 如网络限制，请自行下载对应文件到 frontend/static/libs/ 同名覆盖
  ```
- 之后即可 **完全离线** 运行。



## v6 更新
- 修复保存（不再出现 invalid graph）。
- 边连到端口（四边中点），Manhattan 路由加 padding，降低穿过节点的情况。
- 新增：分类重命名；物品重命名/删除；拖拽物品到分类进行重分类。
- 本地库仍可用；若缺失自动从 jsDelivr 加载 `@antv/x6` 与 `@antv/layout`。
