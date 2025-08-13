;(() => {
  "use strict";
  try {
    window.__APP_VERSION__ = "v27-final-fixes";
    console.log("%cMC Progress X6 app.js %s loaded", "color:#16a34a;font-weight:bold", window.__APP_VERSION__);

    const $ = sel => document.querySelector(sel);
    const $$ = sel => Array.from(document.querySelectorAll(sel));

    const API = {
        items: '/api/items',
        upload: '/api/items/upload',
        graphs: '/api/graphs',
        categories: '/api/categories',
    };

    const ICONS = {
        diamond: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAPUlEQVR4nO3BMQEAAADCoPVPbQ8HFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPg4A3wAAQ3m3rUAAAAASUVORK5CYII=',
        pickaxe: 'data:image/png;base64,iVBORw0KGgoAAAANhEUgAAAEAAAABACAYAAACqaXHeAAAAQElEQVR4nO3BAQ0AAADCoPdPbQ43oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8OMBDQAATu9F3wAAAABJRUkJggg==',
        book: 'data:image/png;base64,iVBORw0KGgoAAAANhEUgAAAEAAAABACAYAAACqaXHeAAAAOUlEQVR4nO3BMQEAAADCoPVPbQ8HFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPg4A3wAAQ3m3rUAAAAASUVORK5CYII=',
    };

    const state = {
        graphId: null,
        items: [],
        categories: [],
        selectedCell: null,
    };

    function toast(msg, persist = false) {
        const el = $('#status');
        if (!el) return console.log(msg);
        el.textContent = msg;
        if (!persist) setTimeout(() => { if (el.textContent === msg) el.textContent = 'Ready.'; }, 2500);
    }

    async function fetchJSON(url, opts = {}) {
        const r = await fetch(url, opts).catch(e => { throw new Error('网络错误或后端未运行'); });
        if (!r.ok) {
            const t = await r.text().catch(() => '');
            throw new Error(t || `请求失败: ${r.status}`);
        }
        return r.json();
    }

    let graph = null;
    let dnd = null;

    function initGraph() {
        if (!window.X6) { toast('AntV X6 未加载', true); return; }
        const { Graph } = window.X6;

        Graph.registerNode('mc-node', {
            inherit: 'rect',
            markup: [
                { tagName: 'rect', selector: 'body' },
                { tagName: 'image', selector: 'icon' },
                { tagName: 'text', selector: 'title' },
                { tagName: 'rect', selector: 'notesBody' },
                { tagName: 'foreignObject', selector: 'fo' }
            ],
            attrs: {
                body: { refWidth: '100%', refHeight: '100%', stroke: '#a2a2a2', strokeWidth: 1, fill: 'transparent' },
                icon: { ref: 'body', refX: '50%', refY: '50%', x: '-32', y: '-32', width: 64, height: 64 },
                title: { ref: 'body', refY: '90%', refX: 0.5, fontSize: 12, fill: '#222', textAnchor: 'middle' },
                notesBody: { fill: 'transparent', stroke: 'transparent', strokeWidth: 1 },
            },
            ports: {
                groups: {
                    t: { position: 'top', attrs: { circle: { r: 4, magnet: true, stroke: '#111827', fill: '#fff' } } },
                    b: { position: 'bottom', attrs: { circle: { r: 4, magnet: true, stroke: '#111827', fill: '#fff' } } },
                    l: { position: 'left', attrs: { circle: { r: 4, magnet: true, stroke: '#111827', fill: '#fff' } } },
                    r: { position: 'right', attrs: { circle: { r: 4, magnet: true, stroke: '#111827', fill: '#fff' } } },
                },
                items: [{ group: 't' }, { group: 'b' }, { group: 'l' }, { group: 'r' }]
            },
            propHooks: (metadata) => {
                const { data } = metadata;
                if (!data) return metadata;

                const item = state.items.find(i => i.id === data.itemId) || { name: '未知物品', icon_path: '' };
                const { expanded, notes, detailsPosition = 'bottom', iconSize = 64 } = data;

                metadata.attrs = metadata.attrs || {};
                metadata.attrs.icon = { ...metadata.attrs.icon, 'xlink:href': item.icon_path };
                metadata.attrs.title = { ...metadata.attrs.title, text: data.title || item.name };

                // Adjust icon size and position relative to body
                metadata.attrs.icon = { 
                    ...metadata.attrs.icon, 
                    x: -iconSize / 2, 
                    y: -iconSize / 2, 
                    width: iconSize, 
                    height: iconSize 
                };

                const noteW = 150, noteH = 100, padding = 10;
                if (expanded) {
                    let notesX, notesY;
                    switch (detailsPosition) {
                        case 'top': notesX = 0; notesY = -(noteH + padding); break;
                        case 'left': notesX = -(noteW + padding); notesY = 0; break;
                        case 'right': notesX = metadata.size.width + padding; notesY = 0; break;
                        default: notesX = 0; notesY = metadata.size.height + padding; break;
                    }
                    metadata.attrs.notesBody = { x: notesX, y: notesY, width: noteW, height: noteH, display: 'block' };
                    metadata.attrs.fo = { 
                        x: notesX, y: notesY, width: noteW, height: noteH, display: 'block',
                        innerHTML: `<div style="width:100%; height:100%; box-sizing:border-box; padding:5px; overflow-y:auto; font-family:sans-serif; font-size:12px; color:#333; line-height:1.4;">${(notes || '').replace(/\n/g, '<br/>')}</div>`
                    };
                } else {
                    metadata.attrs.notesBody = { display: 'none' };
                    metadata.attrs.fo = { display: 'none' };
                }
                return metadata;
            },
        });

        graph = new Graph({
            container: document.getElementById('graph'),
            background: { color: '#f3f4f6' },
            grid: { visible: true, size: 10, type: 'mesh' },
            mousewheel: { enabled: true, modifiers: ['ctrl'], minScale: 0.2, maxScale: 2 },
            scroller: { enabled: true, pannable: true },
            snapline: { enabled: true },
            selecting: { enabled: true, rubberband: true, showNodeSelectionBox: true },
            history: { enabled: true },
            clipboard: { enabled: true },
            keyboard: { enabled: true },
            connecting: {
                snap: true, allowBlank: false, allowLoop: false, allowMulti: true,
                router: 'manhattan',
                connector: { name: 'rounded', args: { radius: 8 } },
                anchor: 'center', connectionPoint: 'boundary',
                createEdge: () => graph.createEdge({
                    shape: 'edge',
                    attrs: { line: { stroke: '#374151', strokeWidth: 2, targetMarker: 'classic' } },
                    zIndex: -1,
                }),
            },
        });

        if (X6.Addon?.Dnd) {
            dnd = new X6.Addon.Dnd({ target: graph, scaled: false });
        } else {
            console.warn("Dnd addon not found.");
        }
        console.log("Graph initialized successfully.");
    }

    function renderLibrary() {
        const lib = $('#library');
        if (!lib) return;
        lib.innerHTML = '';
        state.items.forEach(it => {
            const el = document.createElement('div');
            el.className = 'item';
            el.innerHTML = `<img src="${it.icon_path}" alt="${it.name}"><div class="name" title="${it.name}">${it.name}</div>`;
            el.addEventListener('mousedown', e => {
                if (!dnd) return toast('DND 插件未就绪');
                const node = graph.createNode({
                    shape: 'mc-node',
                    size: { width: 84, height: 96 },
                    data: { itemId: it.id, expanded: false, notes: '', detailsPosition: 'bottom', iconSize: 64 },
                });
                dnd.start(node, e);
            });
            lib.appendChild(el);
        });
    }

    async function loadItems() {
        const q = $('#search')?.value || '';
        const cat = $('#category-filter')?.value || '';
        const params = new URLSearchParams({ search: q, category: cat });
        try {
            const res = await fetchJSON(`${API.items}?${params}`);
            state.items = res.items || [];
            renderLibrary();
        } catch (e) {
            toast('获取物品失败: ' + e.message, true);
        }
    }
    
    async function loadCategories() {
        const sel = $('#category-filter');
        if (!sel) return;
        try {
            const res = await fetchJSON(API.categories);
            state.categories = res.categories || [];
            const current = sel.value;
            sel.innerHTML = '<option value="__ALL__">所有分类</option>';
            state.categories.forEach(c => {
                sel.innerHTML += `<option value="${c.name}">${c.name}</option>`;
            });
            sel.value = current;
        } catch (e) {
            toast('获取分类失败：' + e.message);
        }
    }

    async function loadGraphFromDB(graphId) {
        try {
            toast(`正在载入...`, true);
            const full = await fetchJSON(`${API.graphs}/${graphId}`);
            state.graphId = graphId;
            if (!graph) return;
            graph.fromJSON(full.data?.cells || []);
            // Trigger propHooks for all nodes to ensure view is correct
            graph.getNodes().forEach(node => node.setData(node.getData()));
            graph.centerContent();
            toast(`已载入图谱：${full.name}`);
        } catch (e) {
            console.error('Graph load failed:', e);
            toast('载入失败：' + e.message);
        }
    }

    async function saveGraphToDB() {
        if (!graph || !state.graphId) return toast('没有可保存的图谱');
        try {
            const data = graph.toJSON();
            await fetchJSON(`${API.graphs}/${state.graphId}`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(data) 
            });
            toast('已保存到数据库');
        } catch (e) {
            console.error('Save failed:', e);
            toast('保存失败：' + e.message);
        }
    }

    function showLibraryModal(onSelect) {
        let modal = $('#library-modal');
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = 'library-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header"><h3>替换图标</h3><button id="modal-close">&times;</button></div>
                <div class="modal-body"></div>
            </div>`;
        document.body.appendChild(modal);

        const body = modal.querySelector('.modal-body');
        state.items.forEach(it => {
            const el = document.createElement('div');
            el.className = 'item';
            el.innerHTML = `<img src="${it.icon_path}" alt="${it.name}"><div class="name">${it.name}</div>`;
            el.onclick = () => { onSelect(it); modal.remove(); };
            body.appendChild(el);
        });
        $('#modal-close').onclick = () => modal.remove();
    }

    function renderDetailPanel(cell) {
        const form = $('#inspector-form');
        const placeholder = $('#inspector-empty');
        if (!form || !placeholder) return;
        if (!cell || !cell.isNode()) {
            form.classList.add('hidden');
            placeholder.classList.remove('hidden');
            return;
        }

        form.classList.remove('hidden');
        placeholder.classList.add('hidden');
        
        const data = cell.getData() || {};
        const item = state.items.find(i => i.id === data.itemId) || {};

        form.innerHTML = `
            <div class="current-icon">
                <img src="${item.icon_path || ''}" />
                <button id="btn-replace-icon" type="button">替换图标</button>
            </div>
            <label>标题 <input name="title" value="${data.title || item.name || ''}"></label>
            <label>备注 <textarea name="notes" rows="4">${data.notes || ''}</textarea></label>
            <div class="form-group">
                <label>图标大小 <input name="iconSize" type="number" min="16" max="128" step="1" value="${data.iconSize || 64}"></label>
            </div>
            <div class="form-group" id="detail-position-group">
                <label>详情位置
                    <select id="detail-position">
                        <option value="bottom">下方</option>
                        <option value="top">上方</option>
                        <option value="left">左侧</option>
                        <option value="right">右侧</option>
                    </select>
                </label>
            </div>
            <div class="form-group" id="detail-expanded-group">
                <label><input id="detail-expanded" type="checkbox"> 显示详情</label>
            </div>
            <div class="row">
                <button type="submit">保存节点</button>
                <button type="button" id="btn-collapse">折叠详细</button>
            </div>`;

        $('#detail-expanded').checked = !!data.expanded;
        $('#detail-position').value = data.detailsPosition || 'bottom';
        $('#detail-position-group').style.display = data.expanded ? 'block' : 'none';
        $('#detail-expanded').onchange = (e) => { $('#detail-position-group').style.display = e.target.checked ? 'block' : 'none'; };
        $('#btn-replace-icon').onclick = () => showLibraryModal(newItem => {
            cell.setData({ ...cell.getData(), itemId: newItem.id });
            cell.setProp('data', cell.getData()); // Force re-render
        });

        form.onsubmit = (e) => {
            e.preventDefault();
            cell.setData({
                ...data,
                title: form.title.value, // Allow overriding title
                notes: form.notes.value,
                expanded: $('#detail-expanded').checked,
                detailsPosition: $('#detail-position').value,
                iconSize: parseInt(form.iconSize.value, 10),
            });
            cell.setProp('data', cell.getData()); // Force re-render
            toast('节点已更新');
        };
    }

    function bindAllEventListeners() {
        if (!graph) return;
        graph.on('cell:click', ({ cell }) => { state.selectedCell = cell; renderDetailPanel(cell); });
        graph.on('blank:click', () => { state.selectedCell = null; renderDetailPanel(null); });

        $('#btn-undo')?.addEventListener('click', () => graph.history.undo());
        $('#btn-redo')?.addEventListener('click', () => graph.history.redo());
        $('#btn-export')?.addEventListener('click', () => {
            graph.toPNG(dataUri => {
                const a = document.createElement('a');
                a.href = dataUri;
                a.download = 'graph.png';
                a.click();
            }, { backgroundColor: '#f3f4f6', padding: 20 });
        });
        $('#btn-save')?.addEventListener('click', saveGraphToDB);
        $('#btn-autolayout')?.addEventListener('click', () => {
            if (!window.G6Layout?.dagre) { toast('布局库未加载'); return; }
            const dagre = window.G6Layout.dagre;
            const model = {
                nodes: graph.getNodes().map(n => ({ id: n.id, ...n.getSize() })),
                edges: graph.getEdges().map(e => ({ source: e.getSourceCellId(), target: e.getTargetCellId() })),
            };
            const layout = new dagre({ type: 'dagre', rankdir: 'LR', nodesep: 32, ranksep: 50 });
            layout.layout(model);
            graph.freeze();
            model.nodes.forEach(n => graph.getCellById(n.id)?.position(n.x, n.y));
            graph.unfreeze();
        });

        const quickGenHandler = (options) => {
            const base = state.selectedCell;
            if (!base || !base.isNode()) return toast('请先点击选择一个节点');
            const p = base.getPosition();
            options.forEach(opt => {
                const newNode = graph.addNode({
                    shape: 'mc-node',
                    position: { x: p.x + opt.dx, y: p.y + opt.dy },
                    size: { width: 84, height: 96 },
                    data: { itemId: state.items.find(i => i.name === opt.label)?.id || null, title: opt.label, expanded: false, notes: '', detailsPosition: 'bottom', iconSize: 64 },
                });
                graph.addEdge({
                    source: { cell: base.id, port: 'r' }, 
                    target: { cell: newNode.id, port: 'l' },
                    shape: 'edge',
                    attrs: { line: { stroke: '#374151', strokeWidth: 2, targetMarker: 'classic' } },
                    zIndex: -1, router: { name: 'manhattan' }, connector: { name: 'rounded' },
                });
            });
        };
        $('#btn-stub')?.addEventListener('click', () => quickGenHandler([{ label:'短横', dx: 200, dy: 0 }]));
        $('#btn-fork')?.addEventListener('click', () => quickGenHandler([
            { label:'分支A', dx: 200, dy: -80 },
            { label:'分支B', dx: 200, dy: 80 },
        ]));
        $('#btn-new-level')?.addEventListener('click', () => quickGenHandler([{ label: '独立层级', dx: 280, dy: 0 }]));

        $('#search')?.addEventListener('input', loadItems);
        $('#category-filter')?.addEventListener('change', loadItems);
        $('#btn-add-category')?.addEventListener('click', async () => {
            const name = $('#new-category-name')?.value.trim();
            if (!name) return toast('请输入分类名');
            try {
                await fetchJSON(API.categories, { method: 'POST', body: new URLSearchParams({ name }) });
                toast('分类已添加');
                $('#new-category-name').value = '';
                await loadCategories();
            } catch (e) { toast('添加失败：' + e.message); }
        });
        $('#btn-rename-category')?.addEventListener('click', async () => {
            const sel = $('#category-filter');
            const currentCatName = sel.value;
            if (!currentCatName || currentCatName === '__ALL__') return toast('请选择要重命名的分类');
            const targetName = $('#rename-category-name')?.value.trim();
            if (!targetName) return toast('请输入新分类名');
            const category = state.categories.find(c => c.name === currentCatName);
            if (!category) return toast('分类在状态中未找到');
            try {
                await fetchJSON(`${API.categories}/${category.id}`, { method: 'PATCH', body: new URLSearchParams({ name: targetName }) });
                toast('分类已重命名');
                $('#rename-category-name').value = '';
                await loadCategories();
                sel.value = targetName;
                await loadItems();
            } catch (e) { toast('重命名失败：' + e.message); }
        });

        const doUpload = async (files) => {
            if (!files || !files.length) return;
            const fd = new FormData();
            Array.from(files).forEach(f => fd.append('files', f));
            fd.append('category', $('#category-filter')?.value || 'General');
            try {
                await fetchJSON(API.upload, { method: 'POST', body: fd });
                toast('上传成功');
                await loadItems();
            } catch (e) { toast('上传失败：' + e.message, true); }
        };
        $('#btn-choose-files')?.addEventListener('click', () => $('#upload-input')?.click());
        $('#upload-input')?.addEventListener('change', (e) => doUpload(e.target.files));
        const setupDragUpload = (target, highlight) => {
            target.addEventListener('dragenter', e => { e.preventDefault(); highlight.classList.add('dragover'); });
            target.addEventListener('dragover', e => e.preventDefault());
            target.addEventListener('dragleave', e => { e.preventDefault(); highlight.classList.remove('dragover'); });
            target.addEventListener('drop', e => { e.preventDefault(); highlight.classList.remove('dragover'); doUpload(e.dataTransfer.files); });
        };
        setupDragUpload($('#upload-drop'), $('#upload-drop'));
        setupDragUpload($('#library'), $('#upload-drop'));

        const ul = $('#graph-list');
        if (ul) {
            fetchJSON(API.graphs).then(res => {
                ul.innerHTML = '';
                (res.graphs || []).forEach(g => {
                    const li = document.createElement('li');
                    const btn = document.createElement('button');
                    btn.textContent = `${g.name} · ${new Date(g.updated_at).toLocaleString()}`;
                    btn.addEventListener('click', () => loadGraphFromDB(g.id));
                    li.appendChild(btn);
                    ul.appendChild(li);
                });
                if (res.graphs?.length > 0 && !state.graphId) {
                    loadGraphFromDB(res.graphs[0].id);
                }
            }).catch(() => toast('获取图谱列表失败', true));
        }
    }

    async function boot() {
        await loadItems(); 
        await loadCategories();
        initGraph();
        bindAllEventListeners();
        fetchJSON(API.graphs).then(res => {
            if (res.graphs?.length > 0) loadGraphFromDB(res.graphs[0].id);
        });
    }

    window.addEventListener('DOMContentLoaded', boot);

  } catch (e) {
    console.error("Fatal error in app.js:", e);
    document.body.innerHTML = `<div style="padding: 2em; text-align: center; font-family: sans-serif;"><h1>脚本发生致命错误</h1><p>${e.message}</p></div>`;
  }
})();
