import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, ArrowUpRight, BookOpen, Check, ChevronDown, CircleHelp, Crosshair, GitBranch, Globe2, Hand, Layers3, Link2, LockKeyhole, Maximize, Minus, Move, Orbit, Plus, Rotate3D, Search, ShieldCheck, Sparkles, UsersRound, X } from 'lucide-react';
import { Scene, type EditMode, type SceneHandle } from '../components/scene/Scene';
import { PersonDetailPanel } from '../components/panels/PersonDetailPanel';
import { ConnectionEditor, RelationshipEditor } from '../components/panels/Editors';
import { Modal } from '../components/panels/Modal';
import { exportGraph, useGraphStore } from '../stores/graphStore';
import { validateGraph } from '../domain/graph';

interface Confirmation { title: string; message: string; detail?: string; label: string; danger?: boolean; action: () => void }
export default function App() {
  const graph = useGraphStore(s => s.graph), selectedId = useGraphStore(s => s.selectedId), focusedId = useGraphStore(s => s.focusedId);
  const ready = useGraphStore(s => s.ready), saveStatus = useGraphStore(s => s.saveStatus), notice = useGraphStore(s => s.notice), draft = useGraphStore(s => s.draft), showLabels = useGraphStore(s => s.view.showLabels);
  const [search, setSearch] = useState(''), [searchOpen, setSearchOpen] = useState(false), [drawer, setDrawer] = useState<'people' | 'memories' | null>(null);
  const [relationshipId, setRelationshipId] = useState<string | null>(null), [help, setHelp] = useState(false), [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [editMode, setEditMode] = useState<EditMode>('pan');
  const [spacePan, setSpacePan] = useState(false);
  const activeMode = spacePan ? 'pan' : editMode;
  const fileRef = useRef<HTMLInputElement>(null), sceneRef = useRef<SceneHandle>(null);
  const selected = graph.people.find(p => p.id === selectedId);
  useEffect(() => { void useGraphStore.getState().initialize().then(() => { if (matchMedia('(max-width: 760px)').matches) useGraphStore.getState().select(null); }); }, []);
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (event.metaKey || event.ctrlKey || event.altKey || target.closest('input, textarea, select, [contenteditable="true"]') || document.querySelector('[role="dialog"]')) return;
      if (event.code === 'Space') { event.preventDefault(); setSpacePan(true); return; }
      if (event.repeat) return;
      const modes: Record<string, EditMode> = { h: 'pan', r: 'rotate', v: 'move', c: 'connect' };
      const mode = modes[event.key.toLowerCase()];
      if (mode) { event.preventDefault(); setEditMode(mode); }
    }
    function keyup(event: KeyboardEvent) { if (event.code === 'Space') { event.preventDefault(); setSpacePan(false); } }
    const release = () => setSpacePan(false);
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', release);
    return () => { window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', release); };
  }, []);
  function addPerson() {
    if (!ready) return;
    const person = selected ?? graph.people.find(p => p.id === graph.rootPersonId)!;
    useGraphStore.getState().setDraft({ sourceId: person.id, position: { x: person.position.x + 4, y: person.position.y + 1.5, z: person.position.z } });
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('备份文件不能超过 10 MB。');
      const imported = validateGraph(JSON.parse(await file.text()));
      setConfirmation({ title: '导入你的宇宙', message: `这份备份包含 ${imported.people.length} 个人物、${imported.relationships.length} 段关系和 ${imported.memories.length} 段经历。`, detail: '导入将覆盖当前图谱。建议先导出当前数据作为备份。', label: '覆盖并导入', action: () => useGraphStore.getState().replaceGraph(imported) });
    } catch (e) { useGraphStore.getState().notify(`导入失败：${e instanceof SyntaxError ? '文件不是有效的 JSON 备份。' : (e as Error).message}`); }
    if (fileRef.current) fileRef.current.value = '';
  }
  function deletePerson(id: string) {
    const person = graph.people.find(p => p.id === id)!;
    const relationCount = graph.relationships.filter(r => r.sourceId === id || r.targetId === id).length;
    const memoryCount = graph.memories.filter(m => m.personId === id).length;
    setConfirmation({ title: `删除「${person.name}」？`, message: `同时删除与 TA 相连的 ${relationCount} 段关系和 ${memoryCount} 段共同经历。`, detail: '此操作无法撤销。你可以先导出备份。', label: '删除人物', danger: true, action: () => useGraphStore.getState().deletePerson(id) });
  }
  function selectPerson(id: string) { useGraphStore.getState().focus(id); setSearchOpen(false); setSearch(''); setDrawer(null); }
  const matches = graph.people.filter(p => `${p.name} ${p.city ?? ''}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="app-shell">
    <nav className="rail" aria-label="主导航"><a className="rail-logo" href="/" aria-label="Relaverse 首页"><Orbit size={30} strokeWidth={1.35} /></a><div className="rail-divider" /><div className="rail-main"><button className={!drawer ? 'rail-item active' : 'rail-item'} onClick={() => setDrawer(null)} aria-label="关系宇宙" title="关系宇宙"><Orbit size={21} /><span>宇宙</span></button><button className={drawer === 'people' ? 'rail-item active' : 'rail-item'} onClick={() => setDrawer(drawer === 'people' ? null : 'people')} aria-label="人物列表" title="人物列表"><UsersRound size={21} /><span>人物</span></button><button className={drawer === 'memories' ? 'rail-item active' : 'rail-item'} onClick={() => setDrawer(drawer === 'memories' ? null : 'memories')} aria-label="记忆收藏" title="记忆收藏"><BookOpen size={20} /><span>记忆</span></button></div><div className="rail-bottom"><button className="rail-item" onClick={() => setHelp(true)} aria-label="使用指南" title="使用指南"><CircleHelp size={20} /></button><div className="rail-user" title="我的私人宇宙">我<span /></div></div></nav>
    <div className="workspace">
      <header className="app-header"><div className="brand"><span>relaverse<span className="brand-dot">.</span></span><i /><span className="brand-subtitle">关系宇宙</span></div><div className="header-right"><span className="private-label"><LockKeyhole size={12} />私人空间</span><button className="header-help" onClick={() => setHelp(true)}>探索指南 <ArrowUpRight size={13} /></button></div></header>
      <div className="workspace-toolbar"><div className="universe-selector"><div className="universe-icon"><Globe2 size={18} /></div><div><h1>我的关系宇宙</h1><span>MY PERSONAL UNIVERSE</span></div><ChevronDown size={14} className="selector-chevron" /></div><div className="toolbar-actions"><div className="search-wrap"><Search size={15} /><input aria-label="搜索人物" placeholder="寻找一颗星…" value={search} onFocus={() => setSearchOpen(true)} onChange={e => { setSearch(e.target.value); setSearchOpen(true); }} onKeyDown={e => { if (e.key === 'Escape') setSearchOpen(false); if (e.key === 'Enter' && matches[0]) selectPerson(matches[0].id); }} /><kbd>↵</kbd>{searchOpen && <><button className="search-dismiss" aria-label="关闭搜索" onClick={() => setSearchOpen(false)} /><div className="search-results"><span className="eyebrow">你的宇宙 · {matches.length} 个人物</span>{matches.length ? matches.map(p => <button key={p.id} onClick={() => selectPerson(p.id)}><span className={`mini-avatar ${p.id === graph.rootPersonId ? 'mint' : 'blue'}`}>{p.name.slice(0, 1)}</span><strong>{p.name}</strong><small>{p.city || (p.id === graph.rootPersonId ? '宇宙起点' : '人物')}</small><Crosshair size={14} /></button>) : <p>没有找到这个人物，试试其他名字。</p>}</div></>}</div><div className="toolbar-divider" /><button className="backup-button" title="导入 JSON 备份" onClick={() => fileRef.current?.click()} disabled={!ready}><ArrowUpFromLine size={15} /><span>导入</span></button><button className="backup-button" title="导出 JSON 备份" onClick={() => { exportGraph(); useGraphStore.getState().notify('备份已导出'); }} disabled={!ready}><ArrowDownToLine size={15} /><span>导出</span></button><button className="primary-button add-person" onClick={addPerson} disabled={!ready}><Plus size={16} />添加人物</button></div></div>
      <div className="main-area"><main className={`universe-stage edit-${activeMode}`} aria-label="3D 关系图谱"><div className="artwork-background" /><div className="canvas-atmosphere" /><div className="coordinate-grid" /><div className="cosmos-orbit orbit-one" /><div className="cosmos-orbit orbit-two" /><div className="stage-heading"><span className="eyebrow"><Sparkles size={12} /> YOUR UNIVERSE, YOUR STORIES</span><h2>{focusedId ? `${graph.people.find(p => p.id === focusedId)?.name}的引力场` : <>把相遇，<em>写进星空。</em></>}</h2><p>{focusedId ? 'TA 与身边重要的人的直接连接' : '每一个人，都是你宇宙里不可替代的一颗星。'}</p></div><Scene ref={sceneRef} onEditRelationship={setRelationshipId} editMode={activeMode} />
        <div className="edit-mode-switch" role="group" aria-label="画布操作模式"><button title="平移整个视图 · 快捷键 H" className={activeMode === 'pan' ? 'active' : ''} aria-pressed={activeMode === 'pan'} onClick={() => setEditMode('pan')}><Hand size={15} />平移<kbd>H</kbd></button><button title="旋转整个视图 · 快捷键 R" className={activeMode === 'rotate' ? 'active' : ''} aria-pressed={activeMode === 'rotate'} onClick={() => setEditMode('rotate')}><Rotate3D size={15} />旋转<kbd>R</kbd></button><span className="mode-separator" /><button title="移动单个人物 · 快捷键 V" className={activeMode === 'move' ? 'active' : ''} aria-pressed={activeMode === 'move'} onClick={() => setEditMode('move')}><Move size={14} />人物<kbd>V</kbd></button><button title="拖线连接 · 快捷键 C" className={activeMode === 'connect' ? 'active' : ''} aria-pressed={activeMode === 'connect'} onClick={() => setEditMode('connect')}><Link2 size={14} />连线<kbd>C</kbd></button></div>
        <div className="drag-guide"><span className="guide-icon">{activeMode === 'pan' ? <Hand size={14} /> : activeMode === 'rotate' ? <Rotate3D size={14} /> : <Move size={14} />}</span><span>{activeMode === 'connect' ? '按住球体拖出连线 · 松开创建或连接人物' : activeMode === 'move' ? '拖动单个人物调整位置 · 按住空格临时平移' : activeMode === 'rotate' ? '按住空白拖动旋转 · 按住空格临时平移' : spacePan ? '空格临时平移 · 松开空格恢复原来的模式' : '按住空白拖动整个视图 · 双指滑动缩放'}</span></div>
        <a className="artwork-credit" href="https://commons.wikimedia.org/wiki/File:Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg" target="_blank" rel="noreferrer"><span>THE STARRY NIGHT, 1889</span><small>Vincent van Gogh · 星月夜</small><ArrowUpRight size={11} /></a>
        <div className="view-mode"><span className="live-dot" /><span>3D 空间</span><i /><button title={showLabels ? '隐藏关系和人物标签' : '显示关系和人物标签'} aria-label={showLabels ? '隐藏标签' : '显示标签'} className={showLabels ? 'selected' : ''} onClick={() => useGraphStore.getState().setView({ showLabels: !showLabels })}><Layers3 size={14} />标签</button></div>
        {drawer && <div className="universe-drawer"><div className="drawer-heading"><h2>{drawer === 'people' ? '宇宙中的人物' : '记忆收藏'}</h2><button className="icon-button" aria-label="关闭列表" onClick={() => setDrawer(null)}><X size={16} /></button></div>{drawer === 'people' ? <><p className="drawer-subtitle">{graph.people.length} 颗独特的星，各有各的故事。</p>{graph.people.map(p => <button className="person-list-item" key={p.id} onClick={() => selectPerson(p.id)}><span className={`mini-avatar ${p.id === graph.rootPersonId ? 'mint' : 'blue'}`}>{p.name.slice(0, 1)}</span><div><strong>{p.name}</strong><small>{p.city || (p.id === graph.rootPersonId ? '我的宇宙起点' : '点击聚焦并查看档案')}</small></div><ArrowUpRight size={14} /></button>)}<button className="drawer-add secondary-button" onClick={addPerson}><Plus size={15} />添加一个人物</button></> : <><p className="drawer-subtitle">把一起走过的时刻，留在宇宙里。</p>{graph.memories.length ? graph.memories.map(m => <button className="collection-memory" key={m.id} onClick={() => selectPerson(m.personId)}><span>{m.date || '某个值得记住的日子'}</span><strong>{m.title}</strong><small>与 {graph.people.find(p => p.id === m.personId)?.name} <ArrowUpRight size={12} /></small></button>) : <div className="drawer-empty"><BookOpen size={26} /><p>还没有收藏的记忆</p><span>选择人物，在「共同经历」中记录第一个故事。</span></div>}</>}</div>}
        {graph.people.length === 1 && !drawer && <div className="first-connection-card"><div className="welcome-spark"><Sparkles size={18} /></div><div><span>从一个人，开始一个宇宙</span><p>拖动「我」旁的 <Plus size={11} />，连接生命中的第一颗星。</p><button onClick={addPerson}>开始第一段连接 <ArrowUpRight size={14} /></button></div></div>}
        <div className="stage-controls"><div className="zoom-controls"><button onClick={() => sceneRef.current?.zoom(2)} aria-label="放大" title="放大"><Plus size={17} /></button><span /><button onClick={() => sceneRef.current?.zoom(-2)} aria-label="缩小" title="缩小"><Minus size={17} /></button></div><button className="global-view" onClick={() => useGraphStore.getState().focus(null)}><Maximize size={15} /><span>{focusedId ? '返回全局视图' : '全局视图'}</span></button></div>
        <div className="universe-metrics"><div><span>人物</span><strong>{String(graph.people.length).padStart(2, '0')}</strong></div><i /><div><span>连接</span><strong>{String(graph.relationships.length).padStart(2, '0')}</strong></div><i /><div><span>共同经历</span><strong>{String(graph.memories.length).padStart(2, '0')}</strong></div></div><div className="axis-gizmo"><span className="axis-z">z</span><span className="axis-y">y</span><span className="axis-x">x</span><i /><b /></div>
      </main>{selected && <PersonDetailPanel key={selected.id} person={selected} onEditRelationship={setRelationshipId} onDelete={deletePerson} />}</div>
      <footer className="app-footer"><div className="interaction-hints"><span><span className="mouse-icon" />{activeMode === 'rotate' ? '拖动旋转视图' : '拖动平移视图'}</span><i /><span>双指滑动缩放</span><i /><span>空格临时平移</span><i /><span><GitBranch size={12} />拖动 + 建立连接</span></div><button className={`save-indicator ${saveStatus}`} onClick={() => { if (saveStatus === 'error') useGraphStore.getState().retrySave(); }} title={saveStatus === 'error' ? '点击重试保存' : '数据仅保存在你的浏览器'}>{saveStatus === 'saved' ? <Check size={12} /> : <span className="status-dot" />}{saveStatus === 'saved' ? '已保存到本地' : saveStatus === 'saving' ? '正在保存…' : '保存失败 · 点击重试'}<span className="footer-version">V 1.0</span></button></footer>
    </div>
    <input ref={fileRef} className="visually-hidden" type="file" accept=".json,application/json" aria-label="选择 JSON 备份" onChange={e => void importFile(e.target.files?.[0])} />
    {draft && <ConnectionEditor key={`${draft.sourceId}-${draft.targetId ?? 'new'}`} />}
    {relationshipId && <RelationshipEditor key={relationshipId} id={relationshipId} onClose={() => setRelationshipId(null)} />}
    {confirmation && <Modal title={confirmation.title} onClose={() => setConfirmation(null)}><div className="confirmation-content"><p>{confirmation.message}</p>{confirmation.detail && <div className={confirmation.danger ? 'delete-warning' : 'info-warning'}>{confirmation.detail}</div>}</div><div className="modal-footer"><button className="secondary-button" onClick={() => setConfirmation(null)}>取消</button><button className={confirmation.danger ? 'danger-button' : 'primary-button'} onClick={() => { confirmation.action(); setConfirmation(null); }}>{confirmation.label}</button></div></Modal>}
    {help && <Modal title="欢迎来到你的关系宇宙" subtitle="让连接有形，让记忆有处安放。" onClose={() => setHelp(false)} wide><div className="help-grid"><article><span>01</span><Hand size={23} /><h3>触摸板也能自由探索</h3><p>点击「平移 / 旋转」切换按住拖动的效果，双指滑动缩放。H 平移、R 旋转，按住空格临时平移。双击人物聚焦。</p></article><article><span>02</span><Link2 size={23} /><h3>让关系生长</h3><p>拖动 + 创建或连接人物。切到「人物」模式（V）可移动球体，「连线」模式（C）可从球体拖出关系。</p></article><article><span>03</span><BookOpen size={23} /><h3>收藏共同记忆</h3><p>点击人物编辑相识故事、备注和共同经历。点击连线上的标签，可以修改或删除这段关系。</p></article><article><span>04</span><ShieldCheck size={23} /><h3>只属于你</h3><p>数据自动保存到当前浏览器，无需注册。请定期导出 JSON 备份，避免清理浏览器后丢失资料。</p></article></div><div className="help-note"><LockKeyhole size={14} />你的故事留在这里，不会上传到服务器。</div><div className="modal-footer"><button className="primary-button" onClick={() => setHelp(false)}>开始探索 <ArrowUpRight size={15} /></button></div></Modal>}
    {notice && <div className="toast" role="status"><span className="toast-icon"><Check size={15} /></span>{notice}<button className="icon-button" aria-label="关闭提示" onClick={() => useGraphStore.getState().notify(null)}><X size={14} /></button></div>}
  </div>;
}
