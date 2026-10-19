import { ArrowUpRight, Check, Palette } from 'lucide-react';
import { artworks, type Appearance } from '../../domain/appearance';
import { Modal } from './Modal';

export function AppearancePicker({ appearance, onChange, onClose }: { appearance: Appearance; onChange: (value: Appearance) => void; onClose: () => void }) {
  const selected = artworks.find(artwork => artwork.id === appearance.artworkId)!;
  return <Modal title="为相遇，换一种底色" subtitle="把喜欢的画铺满屏幕，让故事在柔和的色彩里生长。" onClose={onClose} wide>
    <div className="skin-collection-heading"><span><Palette size={14} />印象画廊</span><small>6 幅馆藏 · 点击即刻换肤</small></div>
    <div className="skin-grid" role="group" aria-label="选择画作皮肤">
      {artworks.map(artwork => <button key={artwork.id} className={`skin-card skin-${artwork.id}`} aria-pressed={appearance.artworkId === artwork.id} aria-label={`${artwork.title} · ${artwork.artist}`} onClick={() => onChange({ ...appearance, artworkId: artwork.id })}>
        <span className="skin-thumbnail" aria-hidden="true">{appearance.artworkId === artwork.id && <span className="skin-selected"><Check size={12} />使用中</span>}</span>
        <span className="skin-caption"><strong>{artwork.title}</strong><small>{artwork.artist} · {artwork.year}</small><span>{artwork.mood}</span></span>
      </button>)}
    </div>
    <div className="skin-intensity"><div><label htmlFor="artwork-intensity">画作浓度</label><output htmlFor="artwork-intensity">{appearance.intensity}%</output></div><p className="skin-intensity-hint">整页同步调整，中央画布更浅，外围画作更浓。</p><input id="artwork-intensity" type="range" min="10" max="100" value={appearance.intensity} onChange={event => onChange({ ...appearance, intensity: Number(event.target.value) })} /><div className="skin-range-labels"><span>更淡，专注内容</span><span>更浓，看见笔触</span></div></div>
    <div className="skin-footer"><a href={selected.source} target="_blank" rel="noreferrer">《{selected.title}》· 画作出处 <ArrowUpRight size={12} /></a><button className="primary-button" onClick={onClose}>完成 <Check size={14} /></button></div>
  </Modal>;
}
