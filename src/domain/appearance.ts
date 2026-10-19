export const artworks = [
  { id: 'water-lilies', title: '睡莲', artist: '克洛德·莫奈', year: '1906', mood: '雾紫 · 静谧水庭', source: 'https://www.artic.edu/artworks/16568' },
  { id: 'pourville', title: '普尔维尔悬崖漫步', artist: '克洛德·莫奈', year: '1882', mood: '海蓝 · 微风拂面', source: 'https://www.artic.edu/artworks/14620' },
  { id: 'bordighera', title: '波尔迪盖拉', artist: '克洛德·莫奈', year: '1884', mood: '橄榄绿 · 地中海日光', source: 'https://www.artic.edu/artworks/81537' },
  { id: 'near-the-lake', title: '湖畔', artist: '皮埃尔–奥古斯特·雷诺阿', year: '1879–80', mood: '暖桃 · 林间午后', source: 'https://www.artic.edu/artworks/95654' },
  { id: 'bennecourt', title: '塞纳河畔，贝讷库尔', artist: '克洛德·莫奈', year: '1868', mood: '苔绿 · 河岸光影', source: 'https://www.artic.edu/artworks/81539' },
  { id: 'starry-night', title: '星月夜', artist: '文森特·梵高', year: '1889', mood: '靛蓝 · 星光流动', source: 'https://commons.wikimedia.org/wiki/File:Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg' },
] as const;

export type ArtworkId = typeof artworks[number]['id'];
export interface Appearance { artworkId: ArtworkId; intensity: number }
export const appearanceKey = 'relaverse:appearance:v1';
export const defaultAppearance: Appearance = { artworkId: 'water-lilies', intensity: 22 };

export function readAppearance(): Appearance {
  try {
    const saved = JSON.parse(localStorage.getItem(appearanceKey) ?? 'null');
    return {
      artworkId: artworks.some(artwork => artwork.id === saved?.artworkId) ? saved.artworkId : defaultAppearance.artworkId,
      intensity: typeof saved?.intensity === 'number' && Number.isFinite(saved.intensity)
        ? Math.min(100, Math.max(10, saved.intensity)) : defaultAppearance.intensity,
    };
  } catch { return { ...defaultAppearance }; }
}
