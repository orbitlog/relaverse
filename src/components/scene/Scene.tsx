import { Component, forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { CameraControls, CameraControlsImpl, Line } from '@react-three/drei';
import { AdditiveBlending, CanvasTexture, Color, Group, Plane, Raycaster, Sprite, Vector2, Vector3 } from 'three';
import { Move, MousePointer2, Plus, RotateCcw } from 'lucide-react';
import { useGraphStore } from '../../stores/graphStore';
import { findOpenPosition } from '../../domain/layout';
import type { Person, Relationship, Vector3Data } from '../../types/graph';

export interface SceneHandle { zoom: (amount: number) => void }
export type EditMode = 'pan' | 'rotate' | 'move' | 'connect';
type Interaction = { kind: 'move' | 'connect'; sourceId: string; start: Vector2; plane: Plane; point: Vector3; offset: Vector3; targetId?: string };
type StartInteraction = (kind: 'move' | 'connect', id: string, event: PointerEvent) => void;
const xyz = (p: Vector3Data): [number, number, number] => [p.x, p.y, p.z];
const asData = (p: Vector3): Vector3Data => ({ x: p.x, y: p.y, z: p.z });

// Canvas-backed sprites use the system font, stay camera-facing, and need no remote font file.
function NameSprite({ text, root = false, caption = false, opacity = 1, radius = 0.67 }: { text: string; root?: boolean; caption?: boolean; opacity?: number; radius?: number }) {
  const { camera } = useThree();
  const sprite = useRef<Sprite>(null);
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const font = caption ? '24px sans-serif' : '40px sans-serif';
    ctx.font = font;
    canvas.width = Math.ceil(Math.min(1200, ctx.measureText(text).width + 32)); canvas.height = 80;
    ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = root ? '#61491f' : caption ? '#f2deb0' : '#fff9ed';
    if (!root) { ctx.shadowColor = '#081429'; ctx.shadowBlur = 8; }
    ctx.fillText(text, canvas.width / 2, 40, canvas.width - 20);
    return new CanvasTexture(canvas);
  }, [text, root, caption]);
  useEffect(() => () => texture.dispose(), [texture]);
  useFrame(() => {
    if (root && sprite.current) {
      const world = sprite.current.parent!.getWorldPosition(new Vector3());
      sprite.current.position.copy(camera.position.clone().sub(world).normalize().multiplyScalar(radius + 0.04));
    }
  });
  const height = caption ? 0.42 : 0.55;
  return <sprite ref={sprite} position={root ? [0, 0, radius + 0.04] : [0, -radius - (caption ? 0.5 : 0.45), 0]} scale={[texture.image.width / 80 * height, height, 1]}><spriteMaterial map={texture} transparent opacity={opacity} depthTest={false} depthWrite={false} /></sprite>;
}

function StarField() {
  const positions = useMemo(() => {
    const array = new Float32Array(600 * 3);
    let seed = 142;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 600; i++) {
      array[i * 3] = (random() - 0.5) * 150;
      array[i * 3 + 1] = (random() - 0.5) * 100;
      array[i * 3 + 2] = -25 - random() * 60;
    }
    return array;
  }, []);
  return <points><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry><pointsMaterial color="#ffdf99" size={0.065} transparent opacity={0.35} sizeAttenuation /></points>;
}

function PersonNode({ person, root, selected, dimmed, position, start, showLabel, reduced, onHover, editMode }: {
  person: Person; root: boolean; selected: boolean; dimmed: boolean; position: Vector3Data; start: StartInteraction; showLabel: boolean; reduced: boolean; onHover: (id: string | null) => void; editMode: EditMode;
}) {
  const [hovered, setHovered] = useState(false);
  const floating = useRef<Group>(null);
  const select = useGraphStore(s => s.select), focus = useGraphStore(s => s.focus);
  const color = root ? '#f5d280' : '#9fc8f1';
  const radius = root ? 0.95 : 0.62;
  useFrame(({ clock }) => { if (floating.current) floating.current.position.y = reduced ? 0 : Math.sin(clock.elapsedTime * 0.8 + position.x) * 0.045; });
  function down(event: ThreeEvent<PointerEvent>) {
    if (editMode === 'pan' || editMode === 'rotate') return;
    event.stopPropagation();
    if (event.nativeEvent.button === 0) start(editMode === 'connect' ? 'connect' : 'move', person.id, event.nativeEvent);
  }
  return <group position={xyz(position)}>
    <group ref={floating}>
      <mesh userData={{ personId: person.id }} onPointerDown={down} onPointerOver={e => { e.stopPropagation(); setHovered(true); onHover(person.id); }} onPointerOut={() => { setHovered(false); onHover(null); }} onClick={e => { e.stopPropagation(); select(person.id); }} onDoubleClick={e => { e.stopPropagation(); focus(person.id); }}>
        <sphereGeometry args={[radius, 48, 48]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={root ? 0.1 : 0.04} roughness={0.26} metalness={0.18} transparent opacity={dimmed ? 0.2 : 1} />
      </mesh>
      <mesh scale={root ? 1.9 : 1.65}>
        <sphereGeometry args={[radius, 24, 24]} />
        <meshBasicMaterial color={color} transparent opacity={dimmed ? 0.015 : 0.045} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      {root && <group rotation={[Math.PI / 2.25, 0.2, -0.3]}>
        <mesh><torusGeometry args={[1.45, 0.012, 8, 100]} /><meshBasicMaterial color="#ffe0a0" transparent opacity={dimmed ? 0.08 : 0.75} /></mesh>
        <mesh rotation={[0.6, 0.6, 0.3]}><torusGeometry args={[1.6, 0.007, 8, 100]} /><meshBasicMaterial color="#f7d994" transparent opacity={dimmed ? 0.08 : 0.45} /></mesh>
      </group>}
      {selected && <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -radius - 0.12, 0]}><ringGeometry args={[radius * 1.15, radius * 1.22, 64]} /><meshBasicMaterial color={color} transparent opacity={0.5} side={2} /></mesh>}
      {(showLabel || selected || hovered) && <NameSprite text={person.name} root={root} radius={radius} opacity={dimmed ? 0.25 : 1} />}
      {root && (showLabel || selected) && <NameSprite text="我的宇宙起点" caption radius={radius} opacity={dimmed ? 0.25 : 1} />}
    </group>
  </group>;
}

function RelationshipEdge({ from, to, active }: { from: Vector3Data; to: Vector3Data; active: boolean }) {
  return <Line points={[xyz(from), xyz(to)]} color={active ? '#f4dab0' : '#c0cee8'} lineWidth={active ? 1.8 : 1} transparent opacity={active ? 0.9 : 0.35} />;
}

function Universe({ controlsRef, reduced, startRef, overlays, onHover, onInteraction, clickSuppression, editMode }: { controlsRef: React.RefObject<CameraControls | null>; reduced: boolean; startRef: React.RefObject<StartInteraction | null>; overlays: React.RefObject<Map<string, HTMLDivElement>>; onHover: (id: string | null) => void; onInteraction: (kind: 'move' | 'connect' | null) => void; clickSuppression: React.RefObject<boolean>; editMode: EditMode }) {
  const { camera, gl, scene, size } = useThree();
  const graph = useGraphStore(s => s.graph), selectedId = useGraphStore(s => s.selectedId), focusedId = useGraphStore(s => s.focusedId);
  const focusNonce = useGraphStore(s => s.focusNonce), showLabels = useGraphStore(s => s.view.showLabels), draft = useGraphStore(s => s.draft);
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const [preview, setPreview] = useState<{ position: Vector3Data; targetId?: string } | null>(null);
  const initialView = useRef(useGraphStore.getState().view);
  const raycaster = useMemo(() => new Raycaster(), []);
  const draggedRef = useRef(false);
  const currentGraph = useRef(graph); currentGraph.current = graph;
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.mouseButtons.left = editMode === 'rotate' ? CameraControlsImpl.ACTION.ROTATE : CameraControlsImpl.ACTION.TRUCK;
    controls.mouseButtons.right = CameraControlsImpl.ACTION.NONE;
    controls.touches.one = editMode === 'rotate' ? CameraControlsImpl.ACTION.TOUCH_ROTATE : CameraControlsImpl.ACTION.TOUCH_TRUCK;
    controls.touches.two = CameraControlsImpl.ACTION.TOUCH_DOLLY_TRUCK;
  }, [editMode, controlsRef]);

  useEffect(() => {
    const c = controlsRef.current;
    if (c) c.setLookAt(...initialView.current.camera, ...initialView.current.target, false);
  }, [controlsRef]);
  useEffect(() => {
    if (!focusNonce || !controlsRef.current) return;
    const c = controlsRef.current;
    const target = graph.people.find(p => p.id === focusedId);
    if (target) {
      const p = target.position;
      c.setLookAt(p.x, p.y + 1, p.z + 9, p.x, p.y, p.z, !reduced);
    } else {
      const center = new Vector3(); graph.people.forEach(p => center.add(new Vector3(...xyz(p.position)))); center.divideScalar(graph.people.length);
      const spread = Math.max(4, ...graph.people.map(p => center.distanceTo(new Vector3(...xyz(p.position))) + 2));
      const aspect = gl.domElement.clientWidth / gl.domElement.clientHeight;
      const distance = Math.max(13, spread / Math.sin(Math.PI / 8) / Math.min(1, aspect));
      c.setLookAt(center.x, center.y + distance * 0.12, center.z + distance, center.x, center.y, center.z, !reduced);
    }
  }, [focusNonce, focusedId, controlsRef, reduced]); // Graph edits must not reset the user's camera.

  function project(event: PointerEvent, active: Interaction) {
    const rect = gl.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1), camera);
    const point = new Vector3();
    if (!raycaster.ray.intersectPlane(active.plane, point)) return null;
    const target = active.kind === 'connect' ? raycaster.intersectObjects(scene.children, true).find(hit => hit.object.userData.personId)?.object.userData.personId as string | undefined : undefined;
    if (active.kind === 'move') point.sub(active.offset);
    return { position: asData(point), targetId: target };
  }
  const start: StartInteraction = (kind, id, event) => {
    if (event.button !== 0 || draft) return;
    const person = graph.people.find(p => p.id === id)!;
    const point = new Vector3(...xyz(person.position));
    const plane = new Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new Vector3()), point);
    const rect = gl.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1), camera);
    const intersection = raycaster.ray.intersectPlane(plane, new Vector3());
    const offset = intersection ? intersection.clone().sub(point) : new Vector3();
    const active: Interaction = { kind, sourceId: id, start: new Vector2(event.clientX, event.clientY), plane, point, offset };
    interactionRef.current = active; setInteraction(active); setPreview({ position: person.position });
    onInteraction(kind);
    draggedRef.current = false;
    clickSuppression.current = false;
    if (controlsRef.current) controlsRef.current.enabled = false;
    document.body.style.cursor = kind === 'connect' ? 'crosshair' : 'grabbing';
  };
  startRef.current = start;
  useEffect(() => {
    function cleanup() {
      interactionRef.current = null; setInteraction(null); setPreview(null); onInteraction(null); document.body.style.cursor = '';
      if (controlsRef.current) controlsRef.current.enabled = true;
    }
    function move(event: PointerEvent) {
      const active = interactionRef.current; if (!active) return;
      const next = project(event, active);
      if (next) { active.point.set(...xyz(next.position)); active.targetId = next.targetId; setPreview(next); }
      if (active.start.distanceTo(new Vector2(event.clientX, event.clientY)) > 6) { draggedRef.current = true; clickSuppression.current = true; }
    }
    function up(event: PointerEvent) {
      const active = interactionRef.current; if (!active) return;
      const distance = active.start.distanceTo(new Vector2(event.clientX, event.clientY));
      const next = project(event, active);
      const store = useGraphStore.getState();
      if (next?.targetId === active.sourceId && active.kind === 'connect') {
        store.notify('不能与自己建立关系');
      } else if (next && active.kind === 'connect' && distance >= 35) {
        const source = currentGraph.current.people.find(p => p.id === active.sourceId)!;
        store.setDraft({ sourceId: active.sourceId, targetId: next.targetId, position: next.targetId ? next.position : findOpenPosition(next.position, currentGraph.current.people, source.position) });
      } else if (next && active.kind === 'move' && distance > 6) store.movePerson(active.sourceId, next.position);
      else if (active.kind === 'move') store.select(active.sourceId);
      cleanup();
    }
    function key(event: KeyboardEvent) { if (event.key === 'Escape') cleanup(); }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cleanup); window.addEventListener('blur', cleanup); window.addEventListener('keydown', key);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cleanup); window.removeEventListener('blur', cleanup); window.removeEventListener('keydown', key); document.body.style.cursor = ''; };
  }, [camera, gl, scene]);

  const neighbors = new Set<string>(focusedId ? [focusedId, ...graph.relationships.filter(r => r.sourceId === focusedId || r.targetId === focusedId).flatMap(r => [r.sourceId, r.targetId])] : graph.people.map(p => p.id));
  const groups = new Map<string, Relationship[]>();
  graph.relationships.forEach(r => { const key = [r.sourceId, r.targetId].sort().join(':'); groups.set(key, [...(groups.get(key) ?? []), r]); });
  const position = (p: Person) => interaction?.kind === 'move' && interaction.sourceId === p.id && preview ? preview.position : p.position;
  const source = interaction && graph.people.find(p => p.id === interaction.sourceId);

  // Keep interactive labels in the app's single DOM React root, projected from 3D each frame.
  useFrame(({ clock }) => {
    const projectOverlay = (key: string, point: Vector3) => {
      const element = overlays.current.get(key); if (!element) return;
      const projected = point.project(camera);
      element.style.visibility = projected.z < -1 || projected.z > 1 ? 'hidden' : 'visible';
      element.style.transform = `translate3d(${(projected.x + 1) * size.width / 2}px, ${(-projected.y + 1) * size.height / 2}px, 0)`;
    };
    graph.people.forEach(p => {
      const pos = position(p), radius = p.id === graph.rootPersonId ? 0.95 : 0.62;
      const float = reduced ? 0 : Math.sin(clock.elapsedTime * 0.8 + pos.x) * 0.045;
      const center = new Vector3(pos.x, pos.y + float, pos.z);
      const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      projectOverlay(`person:${p.id}`, center.clone().addScaledVector(right, radius + 0.6).addScaledVector(up, radius * 0.7));
      projectOverlay(`body:${p.id}`, center.clone());
      const body = overlays.current.get(`body:${p.id}`);
      if (body) {
        const projectedCenter = center.clone().project(camera), projectedEdge = center.clone().addScaledVector(right, radius).project(camera);
        const diameter = Math.max(24, Math.abs(projectedEdge.x - projectedCenter.x) * size.width);
        body.style.width = `${diameter}px`; body.style.height = `${diameter}px`;
      }
    });
    [...groups.values()].forEach(edges => {
      const from = position(graph.people.find(p => p.id === edges[0].sourceId)!), to = position(graph.people.find(p => p.id === edges[0].targetId)!);
      projectOverlay(`edge:${edges[0].id}`, new Vector3((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2));
    });
  });

  return <>
    <ambientLight intensity={1.5} />
    <directionalLight position={[-4, 8, 8]} intensity={2.5} color="#fff7ed" />
    <pointLight position={[5, -3, 3]} intensity={35} color="#679bef" />
    <StarField />
    {[...groups.values()].map(edges => {
      const from = graph.people.find(p => p.id === edges[0].sourceId)!, to = graph.people.find(p => p.id === edges[0].targetId)!;
      const active = !focusedId || edges.some(r => r.sourceId === focusedId || r.targetId === focusedId);
      return <RelationshipEdge key={edges[0].id} from={position(from)} to={position(to)} active={active} />;
    })}
    {graph.people.map(person => <PersonNode key={person.id} person={person} root={person.id === graph.rootPersonId} selected={selectedId === person.id || preview?.targetId === person.id} dimmed={!neighbors.has(person.id)} position={position(person)} showLabel={showLabels && (graph.people.length < 35 || selectedId === person.id)} start={start} reduced={reduced} onHover={onHover} editMode={editMode} />)}
    {source && preview && interaction?.kind === 'connect' && <Line points={[xyz(source.position), xyz(preview.targetId ? graph.people.find(p => p.id === preview.targetId)!.position : preview.position)]} color="#ffe5a5" lineWidth={2.5} dashed dashSize={0.18} gapSize={0.12} />}
    {draft && !draft.targetId && <group position={xyz(draft.position)}><mesh><sphereGeometry args={[0.46, 24, 24]} /><meshStandardMaterial color="#9ed7ef" transparent opacity={0.4} wireframe /></mesh><Line points={[xyz({ x: 0, y: 0, z: 0 }), xyz({ x: graph.people.find(p => p.id === draft.sourceId)!.position.x - draft.position.x, y: graph.people.find(p => p.id === draft.sourceId)!.position.y - draft.position.y, z: graph.people.find(p => p.id === draft.sourceId)!.position.z - draft.position.z })]} color="#8ed9c5" dashed dashSize={0.18} gapSize={0.12} /></group>}
    <CameraControls ref={controlsRef} enabled={!interaction && !draft} minDistance={3} maxDistance={1000} smoothTime={reduced ? 0 : 0.3} onRest={() => {
      const c = controlsRef.current; if (!c || interactionRef.current) return;
      const p = c.getPosition(new Vector3()), t = c.getTarget(new Vector3());
      useGraphStore.getState().setView({ camera: p.toArray() as [number, number, number], target: t.toArray() as [number, number, number] });
    }} />
  </>;
}

class SceneBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() { return this.state.error ? <div className="scene-error"><RotateCcw size={30} /><h2>3D 场景暂时无法打开</h2><p>请开启浏览器硬件加速并刷新。你仍可通过人物列表编辑资料、导入和导出备份。</p><button className="primary-button" onClick={() => location.reload()}>重新加载</button></div> : this.props.children; }
}

export const Scene = forwardRef<SceneHandle, { onEditRelationship: (id: string) => void; editMode: EditMode }>(function Scene({ onEditRelationship, editMode }, ref) {
  const controlsRef = useRef<CameraControls>(null);
  const startRef = useRef<StartInteraction | null>(null);
  const overlays = useRef(new Map<string, HTMLDivElement>());
  const clickSuppression = useRef(false);
  const graph = useGraphStore(s => s.graph), selectedId = useGraphStore(s => s.selectedId), focusedId = useGraphStore(s => s.focusedId), showLabels = useGraphStore(s => s.view.showLabels);
  const view = useGraphStore(s => s.view);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeInteraction, setActiveInteraction] = useState<'move' | 'connect' | null>(null);
  const ready = useGraphStore(s => s.ready);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => { const media = matchMedia('(prefers-reduced-motion: reduce)'); const change = () => setReduced(media.matches); media.addEventListener('change', change); return () => media.removeEventListener('change', change); }, []);
  useImperativeHandle(ref, () => ({ zoom: amount => { controlsRef.current?.dolly(amount, !reduced); } }), [reduced]);
  if (!ready) return <div className="scene-loading"><span className="loading-orbit" />正在打开你的宇宙…</div>;
  const groups = new Map<string, Relationship[]>();
  graph.relationships.forEach(r => { const key = [r.sourceId, r.targetId].sort().join(':'); groups.set(key, [...(groups.get(key) ?? []), r]); });
  const setOverlay = (key: string, element: HTMLDivElement | null) => { if (element) overlays.current.set(key, element); else overlays.current.delete(key); };
  return <SceneBoundary><div className="scene-host" data-view-mode={editMode} data-view-camera={JSON.stringify(view.camera)} data-view-target={JSON.stringify(view.target)}><Canvas camera={{ position: [0, 2, 17], fov: 45, near: 0.1, far: 2000 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }} onCreated={({ gl }) => { gl.setClearColor(new Color('#132850'), 0); }}><Universe controlsRef={controlsRef} reduced={reduced} startRef={startRef} overlays={overlays} onHover={setHoveredId} onInteraction={setActiveInteraction} clickSuppression={clickSuppression} editMode={editMode} /></Canvas><div className="scene-overlays">
    {graph.people.map(p => <div key={p.id}>
      <div className="projected-overlay node-body-overlay" data-person-id={p.id} data-position={JSON.stringify(p.position)} ref={element => setOverlay(`body:${p.id}`, element)}><button className={`node-hit-target ${editMode === 'connect' ? 'connect-mode' : ''}`} style={{ pointerEvents: editMode === 'move' || editMode === 'connect' ? 'auto' : 'none' }} aria-label={editMode === 'connect' ? `拖动${p.name}建立关系` : editMode === 'move' ? `拖动${p.name}移动位置` : `查看${p.name}的档案`} title={editMode === 'connect' ? '按住拖动，连接人物或创建新人' : editMode === 'move' ? '按住球体拖动，移动人物；双击聚焦' : '点击查看档案，双击聚焦；拖动当前视图'} onPointerEnter={() => setHoveredId(p.id)} onPointerLeave={() => setHoveredId(null)} onPointerDown={e => { if (editMode !== 'move' && editMode !== 'connect') return; e.stopPropagation(); e.preventDefault(); startRef.current?.(editMode === 'connect' ? 'connect' : 'move', p.id, e.nativeEvent); }} onClick={() => { if (!clickSuppression.current) useGraphStore.getState().select(p.id); clickSuppression.current = false; }} onDoubleClick={() => useGraphStore.getState().focus(p.id)} onKeyDown={e => {
        const direction: Record<string, [number, number]> = { ArrowLeft: [-0.4, 0], ArrowRight: [0.4, 0], ArrowUp: [0, 0.4], ArrowDown: [0, -0.4] };
        if (direction[e.key] && editMode === 'move') { e.preventDefault(); const [x, y] = direction[e.key]; useGraphStore.getState().movePerson(p.id, { x: p.position.x + x, y: p.position.y + y, z: p.position.z }); }
      }}><span className="node-move-icon"><Move size={16} /></span></button></div>
      <div className="projected-overlay" ref={element => setOverlay(`person:${p.id}`, element)}><button aria-label={`从${p.name}拖出关系`} title="按住 + 拖动：空白处创建新人，球体上连接已有的人" className={`connection-handle ${selectedId === p.id || hoveredId === p.id || graph.people.length === 1 ? 'visible labeled' : ''}`} onPointerDown={e => { e.stopPropagation(); e.preventDefault(); startRef.current?.('connect', p.id, e.nativeEvent); }}><Plus size={17} /><span>拖出关系</span></button></div>
    </div>)}
    {[...groups.values()].map(edges => {
      const active = !focusedId || edges.some(r => r.sourceId === focusedId || r.targetId === focusedId);
      const visible = showLabels && active && (graph.people.length < 35 || edges.some(r => r.sourceId === selectedId || r.targetId === selectedId));
      return <div className="projected-overlay edge-overlay" key={edges[0].id} ref={element => setOverlay(`edge:${edges[0].id}`, element)}><div className="edge-labels" style={{ display: visible ? 'flex' : 'none' }}>{edges.map(edge => <button key={edge.id} onClick={() => onEditRelationship(edge.id)} className={`edge-label ${active ? 'active' : ''}`}>{edge.label}</button>)}</div></div>;
    })}
  </div>{activeInteraction && <div className="drag-feedback">{activeInteraction === 'move' ? <Move size={16} /> : <MousePointer2 size={16} />}<strong>{activeInteraction === 'move' ? '正在移动人物' : '正在建立连接'}</strong><span>{activeInteraction === 'move' ? '松开保存位置' : '拖到空白处创建新人，拖到人物上建立关系'}</span><kbd>Esc 取消</kbd></div>}</div></SceneBoundary>;
});
