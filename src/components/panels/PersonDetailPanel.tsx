import { useState } from 'react';
import { ArrowUpRight, BookOpen, CalendarDays, ChevronRight, Crosshair, Heart, Link2, MapPin, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useGraphStore } from '../../stores/graphStore';
import type { Person, SharedMemory } from '../../types/graph';
import { MemoryEditor } from './Editors';

export function PersonDetailPanel({ person, onEditRelationship, onDelete }: { person: Person; onEditRelationship: (id: string) => void; onDelete: (id: string) => void }) {
  const graph = useGraphStore(s => s.graph);
  const [tab, setTab] = useState<'profile' | 'memories'>('profile');
  const [name, setName] = useState(person.name), [nameError, setNameError] = useState('');
  const [memoryEditor, setMemoryEditor] = useState<SharedMemory | 'new' | null>(null);
  const root = person.id === graph.rootPersonId;
  const relations = graph.relationships.filter(r => r.sourceId === person.id || r.targetId === person.id);
  const memories = graph.memories.filter(m => m.personId === person.id).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  const update = (field: keyof Person, value: string) => useGraphStore.getState().updatePerson(person.id, { [field]: value });
  function saveName() { try { update('name', name); setName(name.trim()); setNameError(''); } catch { setNameError('姓名不能为空'); } }
  function newConnection() { useGraphStore.getState().setDraft({ sourceId: person.id, position: { x: person.position.x + 4, y: person.position.y + 1, z: person.position.z } }); }
  return <aside className="detail-panel" aria-label="人物详情">
    <div className="panel-topline"><span className="eyebrow">PERSON DETAILS</span><button className="icon-button" onClick={() => useGraphStore.getState().select(null)} aria-label="关闭人物详情"><X size={17} /></button></div>
    <div className="profile-intro"><div className={`profile-avatar ${root ? 'mint' : 'blue'}`}>{person.name.slice(0, 1)}<span className="avatar-orbit" /></div><div className="profile-heading"><div className="profile-title"><h2>{person.name}</h2>{root && <span className="tiny-tag">我自己</span>}</div><p>{person.city ? <><MapPin size={12} />{person.city}</> : root ? '一切连接，从这里开始' : '宇宙里独特的一颗星'}</p></div><button className="icon-button focus-person" title="聚焦这个人物" aria-label="聚焦这个人物" onClick={() => useGraphStore.getState().focus(person.id)}><Crosshair size={18} /></button></div>
    <div className="profile-stats"><span><Link2 size={14} /><strong>{relations.length}</strong> 段关系</span><i /><span><BookOpen size={14} /><strong>{memories.length}</strong> 段共同经历</span></div>
    <div className="panel-tabs" role="tablist"><button role="tab" aria-selected={tab === 'profile'} className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}>人物档案</button><button role="tab" aria-selected={tab === 'memories'} className={tab === 'memories' ? 'active' : ''} onClick={() => setTab('memories')}>共同经历<span>{memories.length}</span></button></div>
    <div className="panel-content" role="tabpanel">
      {tab === 'profile' ? <>
        <label className="field compact">姓名 <span>*</span><input aria-label="姓名" maxLength={80} value={name} onChange={e => setName(e.target.value)} onBlur={saveName} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></label>{nameError && <p role="alert" className="form-error">{nameError}</p>}
        <label className="field compact">关于 TA<textarea aria-label="简介" rows={2} placeholder="用几句话，描述这个独特的人…" value={person.description ?? ''} onChange={e => update('description', e.target.value)} /></label>
        <div className="section-label"><Heart size={14} /><span>{root ? '关于我的故事' : '我们的相遇'}</span></div>
        <label className="field compact">{root ? '我的故事从哪里开始' : '我们是如何认识的'}<textarea aria-label="如何认识" className="story-textarea" rows={3} placeholder={root ? '记录一个关于自己的故事…' : '还记得第一次相遇的场景吗？'} value={person.howWeMet ?? ''} onChange={e => update('howWeMet', e.target.value)} /></label>
        <div className="field-row"><label className="field compact">认识时间<input aria-label="认识时间" type="date" value={person.metAt ?? ''} onInput={e => update('metAt', e.currentTarget.value)} onChange={e => update('metAt', e.target.value)} /></label><label className="field compact">认识地点<input aria-label="认识地点" placeholder="在哪里相遇" value={person.metPlace ?? ''} onChange={e => update('metPlace', e.target.value)} /></label></div>
        <label className="field compact">所在城市<input aria-label="所在城市" placeholder="TA 现在生活的地方" value={person.city ?? ''} onChange={e => update('city', e.target.value)} /></label>
        <label className="field compact">个人备注<textarea aria-label="备注" rows={2} placeholder="一些想记住的小事…" value={person.notes ?? ''} onChange={e => update('notes', e.target.value)} /></label>
        <div className="section-label relation-section"><Link2 size={14} /><span>与 TA 的连接</span><button className="text-button" onClick={newConnection}><Plus size={13} />添加</button></div>
        {relations.length ? <div className="relationship-list">{relations.map(r => { const other = graph.people.find(p => p.id === (r.sourceId === person.id ? r.targetId : r.sourceId))!; return <button key={r.id} onClick={() => onEditRelationship(r.id)}><span className="mini-avatar blue">{other.name.slice(0, 1)}</span><strong>{other.name}</strong><span className="relation-chip">{r.label}</span><ChevronRight size={14} /></button>; })}</div> : <div className="empty-relations">还没有连接，故事正要开始。<button onClick={newConnection}>添加第一个人物 <ArrowUpRight size={13} /></button></div>}
      </> : <div className="memories-view"><div className="memory-intro"><span>一起走过的时间</span><button className="text-button" onClick={() => setMemoryEditor('new')}><Plus size={14} />新增经历</button></div>{memories.length ? <div className="memory-timeline">{memories.map(memory => <article className="memory-card" key={memory.id}><span className="timeline-dot" /><div className="memory-date"><CalendarDays size={12} />{memory.date || '某个值得记住的日子'}</div><h3>{memory.title}</h3>{memory.description && <p>{memory.description}</p>}<div className="memory-actions"><button className="text-button" onClick={() => setMemoryEditor(memory)}><Pencil size={12} />编辑</button><button className="text-button danger" onClick={() => useGraphStore.getState().deleteMemory(memory.id)}><Trash2 size={12} />删除</button></div></article>)}</div> : <div className="memory-empty"><div className="empty-memory-icon"><BookOpen size={28} /><span>✦</span></div><h3>把共同的时刻，收藏起来</h3><p>一次旅行、一场重逢，或一个平凡却闪光的下午。</p><button className="secondary-button" onClick={() => setMemoryEditor('new')}><Plus size={14} />记录第一段经历</button></div>}</div>}
      {!root && <button className="delete-person text-button danger" onClick={() => onDelete(person.id)}><Trash2 size={13} />删除这个人物</button>}
    </div>
    <div className="panel-bottom"><span className="status-dot" />修改自动保存到本地<span>仅你可见</span></div>
    {memoryEditor && <MemoryEditor personId={person.id} memory={memoryEditor === 'new' ? undefined : memoryEditor} onClose={() => setMemoryEditor(null)} />}
  </aside>;
}
