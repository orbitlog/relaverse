import { useState, type FormEvent } from 'react';
import { ArrowRight, Link2, Plus, Trash2 } from 'lucide-react';
import { useGraphStore } from '../../stores/graphStore';
import { uid } from '../../domain/graph';
import type { SharedMemory } from '../../types/graph';
import { Modal } from './Modal';

export function ConnectionEditor() {
  const draft = useGraphStore(s => s.draft), graph = useGraphStore(s => s.graph);
  const [name, setName] = useState(''), [label, setLabel] = useState(''), [error, setError] = useState('');
  if (!draft) return null;
  const source = graph.people.find(p => p.id === draft.sourceId)!, target = graph.people.find(p => p.id === draft.targetId);
  const close = () => useGraphStore.getState().setDraft(null);
  function submit(e: FormEvent) { e.preventDefault(); try { useGraphStore.getState().createConnection(name, label); } catch (e) { setError((e as Error).message); } }
  return <Modal title={target ? '连接一段关系' : '让你的宇宙，生长一点'} subtitle={target ? '同一对人物可以拥有多种关系。' : '每一个人，都是你宇宙中独特的一颗星。'} onClose={close}><form onSubmit={submit}>
    <div className="connection-preview"><span className="mini-avatar mint">{source.name.slice(0, 1)}</span><strong>{source.name}</strong><span className="preview-line" /><Link2 size={16} /><span className="preview-line" /><span className="mini-avatar blue">{(target?.name || name || '?').slice(0, 1)}</span><strong>{target?.name || name || '新人物'}</strong></div>
    {!target && <label className="field">人物姓名 <span>*</span><input data-autofocus required maxLength={80} placeholder="TA 的名字" value={name} onChange={e => setName(e.target.value)} /></label>}
    <label className="field">你们的关系 <span>*</span><input data-autofocus={!!target || undefined} required maxLength={80} placeholder="例如：朋友、大学同学、家人" value={label} onChange={e => setLabel(e.target.value)} /></label>
    <div className="relation-suggestions">{['朋友', '家人', '同事', '同学'].map(value => <button className={label === value ? 'chosen' : ''} type="button" key={value} onClick={() => setLabel(value)}>{value}</button>)}</div>
    {error && <p role="alert" className="form-error">{error}</p>}
    <div className="modal-footer"><button type="button" className="secondary-button" onClick={close}>取消</button><button className="primary-button" type="submit">{target ? <Link2 size={16} /> : <Plus size={16} />}{target ? '建立关系' : '添加到宇宙'}<ArrowRight size={15} /></button></div>
  </form></Modal>;
}

export function RelationshipEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const graph = useGraphStore(s => s.graph), relation = graph.relationships.find(r => r.id === id);
  const [label, setLabel] = useState(relation?.label ?? ''), [description, setDescription] = useState(relation?.description ?? ''), [error, setError] = useState(''), [deleting, setDeleting] = useState(false);
  if (!relation) return null;
  const source = graph.people.find(p => p.id === relation.sourceId)!, target = graph.people.find(p => p.id === relation.targetId)!;
  return <Modal title="编辑关系" subtitle={`${source.name} 与 ${target.name} 之间的连接`} onClose={onClose}><form onSubmit={e => { e.preventDefault(); try { useGraphStore.getState().updateRelationship(id, label, description); onClose(); } catch (e) { setError((e as Error).message); } }}>
    <label className="field">关系名称 <span>*</span><input data-autofocus required maxLength={80} value={label} onChange={e => setLabel(e.target.value)} /></label>
    <label className="field">关系说明<textarea rows={4} placeholder="这段关系对你意味着什么？" value={description} onChange={e => setDescription(e.target.value)} /></label>
    {error && <p role="alert" className="form-error">{error}</p>}
    {deleting && <p className="delete-warning">删除这段关系后，两个人物及其记忆都会保留。</p>}
    <div className="modal-footer spread"><button type="button" className="text-button danger" onClick={() => { if (deleting) { useGraphStore.getState().deleteRelationship(id); onClose(); } else setDeleting(true); }}><Trash2 size={15} />{deleting ? '确认删除关系' : '删除关系'}</button><button className="primary-button" type="submit">保存关系</button></div>
  </form></Modal>;
}

export function MemoryEditor({ personId, memory, onClose }: { personId: string; memory?: SharedMemory; onClose: () => void }) {
  const [title, setTitle] = useState(memory?.title ?? ''), [date, setDate] = useState(memory?.date ?? ''), [description, setDescription] = useState(memory?.description ?? ''), [error, setError] = useState('');
  return <Modal title={memory ? '编辑共同经历' : '收藏一段共同经历'} subtitle="让那些一起走过的时刻，有一个安放的地方。" onClose={onClose}><form onSubmit={e => { e.preventDefault(); try { useGraphStore.getState().saveMemory({ id: memory?.id ?? uid(), personId, title, date, description }); onClose(); } catch (e) { setError((e as Error).message); } }}>
    <label className="field">经历标题 <span>*</span><input data-autofocus required maxLength={120} placeholder="例如：一起去看了海" value={title} onChange={e => setTitle(e.target.value)} /></label>
    <label className="field">发生日期<input type="date" value={date} onInput={e => setDate(e.currentTarget.value)} onChange={e => setDate(e.target.value)} /></label>
    <label className="field">记忆细节<textarea rows={4} placeholder="记录当时的风景、对话，或一个小小的瞬间…" value={description} onChange={e => setDescription(e.target.value)} /></label>
    {error && <p role="alert" className="form-error">{error}</p>}
    <div className="modal-footer"><button className="secondary-button" type="button" onClick={onClose}>取消</button><button className="primary-button" type="submit">保存这段记忆</button></div>
  </form></Modal>;
}
