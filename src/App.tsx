import { useMemo, useState } from 'react';
import { addMemory, buildPrompt, initialState, respond, rooms, starterAvatar, type AvatarSpec, type Emotion, type Memory } from './core/studio';
import './app.css';

const tabs = ['Dashboard', 'Designer', 'Rooms', 'Memory', 'Gallery', 'Diagnostics'] as const;
type Tab = typeof tabs[number];

export default function App() {
  const [tab, setTab] = useState<Tab>('Dashboard');
  const [avatar, setAvatar] = useState<AvatarSpec>(starterAvatar);
  const [roomId, setRoomId] = useState('studio');
  const [state, setState] = useState(() => initialState(starterAvatar.id));
  const [memories, setMemories] = useState<Memory[]>([]);
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState('');
  const room = useMemo(() => rooms.find((item) => item.id === roomId) ?? rooms[0], [roomId]);
  const prompt = useMemo(() => buildPrompt(avatar, room), [avatar, room]);

  function saveMemory() {
    if (!message.trim()) return;
    setMemories((items) => addMemory(items, message.trim(), room.id, 0.6));
    setMessage('');
    setToast('Memory saved');
  }

  function talk() {
    if (!message.trim()) return;
    const result = respond(state, message);
    setState(result.state);
    setMemories((items) => addMemory(items, `User: ${message.trim()} | Studio: ${result.text}`, room.id, 0.55));
    setMessage('');
    setToast(result.text);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">GG</span><div><strong>Grok Girls</strong><small>Studio Core</small></div></div>
        <nav>{tabs.map((item) => <button key={item} className={tab === item ? 'nav active' : 'nav'} onClick={() => setTab(item)}>{item}</button>)}</nav>
        <div className="sidebar-foot"><span className="status-dot" /> Local-first core<br /><small>Provider adapters optional</small></div>
      </aside>

      <main className="main">
        <header className="topbar"><div><span className="eyebrow">AVATAR LAB</span><h1>{tab}</h1></div><div className="top-actions"><span className="pill">Room: {room.name}</span><button className="primary" onClick={() => setToast('Scene saved locally')}>Save Scene</button></div></header>

        {tab === 'Dashboard' && <Dashboard state={state} avatar={avatar} room={room.name} memories={memories.length} prompt={prompt} onTab={setTab} />}
        {tab === 'Designer' && <Designer avatar={avatar} setAvatar={setAvatar} prompt={prompt} />}
        {tab === 'Rooms' && <Rooms roomId={roomId} setRoomId={(id) => { setRoomId(id); setState((s) => ({ ...s, roomId: id })); }} />}
        {tab === 'Memory' && <MemoryPanel memories={memories} message={message} setMessage={setMessage} onTalk={talk} onSave={saveMemory} emotion={state.emotion} />}
        {tab === 'Gallery' && <Gallery prompt={prompt} />}
        {tab === 'Diagnostics' && <Diagnostics state={state} memories={memories.length} />}

        {toast && <button className="toast" onClick={() => setToast('')}>{toast} ×</button>}
      </main>
    </div>
  );
}

function Dashboard({ state, avatar, room, memories, prompt, onTab }: { state: ReturnType<typeof initialState>; avatar: AvatarSpec; room: string; memories: number; prompt: string; onTab: (tab: Tab) => void }) {
  return <section className="grid dashboard">
    <div className="hero card"><div><span className="eyebrow">CURRENT CHARACTER</span><h2>{avatar.name}</h2><p>{avatar.personality}</p><div className="hero-actions"><button className="primary" onClick={() => onTab('Designer')}>Open Designer</button><button onClick={() => onTab('Gallery')}>Preview Gallery</button></div></div><div className="avatar-orb"><span>{avatar.name.slice(0, 1)}</span></div></div>
    <Stat title="Emotion" value={state.emotion} /><Stat title="Relationship" value={`Level ${state.relationshipLevel}`} /><Stat title="Memories" value={String(memories)} /><Stat title="Room" value={room} />
    <div className="card wide"><div className="card-title"><h3>Generation Prompt</h3><span className="muted">adapter-ready</span></div><pre>{prompt}</pre></div>
  </section>;
}

function Stat({ title, value }: { title: string; value: string }) { return <div className="card stat"><span className="muted">{title}</span><strong>{value}</strong></div>; }

function Designer({ avatar, setAvatar, prompt }: { avatar: AvatarSpec; setAvatar: (value: AvatarSpec) => void; prompt: string }) {
  const update = (key: keyof AvatarSpec, value: string) => setAvatar({ ...avatar, [key]: value });
  return <section className="designer-grid"><div className="card form"><span className="eyebrow">CHARACTER BUILDER</span><h2>Shape the character</h2><label>Name<input value={avatar.name} onChange={(e) => update('name', e.target.value)} /></label><label>Style<input value={avatar.style} onChange={(e) => update('style', e.target.value)} /></label><label>Hair<input value={avatar.hair} onChange={(e) => update('hair', e.target.value)} /></label><label>Eyes<input value={avatar.eyes} onChange={(e) => update('eyes', e.target.value)} /></label><label>Outfit<input value={avatar.outfit} onChange={(e) => update('outfit', e.target.value)} /></label><label>Personality<textarea value={avatar.personality} onChange={(e) => update('personality', e.target.value)} /></label></div><div className="card preview"><div className="preview-stage"><div className="avatar-orb large"><span>{avatar.name.slice(0, 1)}</span></div></div><h3>{avatar.name}</h3><p className="muted">Prompt updates live. Connect an image adapter when ready.</p><pre>{prompt}</pre></div></section>;
}

function Rooms({ roomId, setRoomId }: { roomId: string; setRoomId: (id: string) => void }) { return <section className="room-grid">{rooms.map((room) => <button key={room.id} className={room.id === roomId ? 'card room selected' : 'card room'} onClick={() => setRoomId(room.id)}><span className="room-icon">{room.name.slice(0, 1)}</span><h3>{room.name}</h3><p>{room.description}</p><small>{room.objects.join(' · ')}</small></button>)}</section>; }

function MemoryPanel({ memories, message, setMessage, onTalk, onSave, emotion }: { memories: Memory[]; message: string; setMessage: (value: string) => void; onTalk: () => void; onSave: () => void; emotion: Emotion }) { return <section className="memory-grid"><div className="card chat"><div className="card-title"><h2>Conversation Brain</h2><span className="pill">{emotion}</span></div><div className="chat-input"><textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Talk to the character or add a memory..." /><div><button onClick={onSave}>Save Memory</button><button className="primary" onClick={onTalk}>Talk</button></div></div></div><div className="card"><div className="card-title"><h3>Recent memory</h3><span className="muted">{memories.length}</span></div>{memories.length === 0 ? <p className="muted">No memories yet.</p> : <ul className="memory-list">{memories.slice(0, 12).map((m) => <li key={m.id}><strong>{m.summary}</strong><small>{new Date(m.createdAt).toLocaleTimeString()}</small></li>)}</ul>}</div></section>; }

function Gallery({ prompt }: { prompt: string }) { return <section className="gallery"><div className="card gallery-card"><div className="gallery-placeholder">Preview</div><h2>Scene Gallery</h2><p className="muted">Generation is isolated behind adapters so the studio can run without cloud credentials.</p><pre>{prompt}</pre></div><div className="card"><h3>Export</h3><p className="muted">Existing VideoExportPage and API adapters remain available for integration.</p><button onClick={() => navigator.clipboard?.writeText(prompt)}>Copy Prompt</button></div></section>; }

function Diagnostics({ state, memories }: { state: ReturnType<typeof initialState>; memories: number }) { const checks = [['Core state', true], ['Memory store', true], ['Room engine', true], ['Provider boundary', true], ['Remote credentials', false]]; return <section className="diagnostics"><div className="card"><span className="eyebrow">SYSTEM MONITOR</span><h2>Health</h2>{checks.map(([name, ok]) => <div className="check" key={name as string}><span className={ok ? 'status-dot' : 'status-dot warn'} />{name}<strong>{ok ? 'READY' : 'OPTIONAL'}</strong></div>)}</div><div className="card"><h3>Runtime snapshot</h3><pre>{JSON.stringify({ state, memories }, null, 2)}</pre></div></section>; }
