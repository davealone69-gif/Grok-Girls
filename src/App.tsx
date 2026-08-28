import React, { useMemo, useState, useEffect } from 'react';
import { Girl, Mode, rooms, seedGirls, Room } from './models/studio';
import { advanceStory, initialStory, StoryState, storyChapters, storyPrompt } from './models/story';
import { addMemory, buildGenerationPrompt, loadGirls, saveGirls } from './services/memory';
import { AvatarState, interactionState, loadAvatarState, saveAvatarState, statePrompt } from './services/avatarState';
import { addGalleryItem, loadGallery, toggleFavorite, GalleryItem } from './services/gallery';
import { generateWithFallback, ProviderName } from './services/providers';
import { ChatMessage, loadChat, reply, saveChat } from './services/chat';
import { saveAvatar } from './services/avatarEditor';
import { downloadMedia, exportGallery, importGallery } from './services/media';
import { AvatarDraft, avatarOptions, randomizeAvatar, buildDraftPrompt } from './services/avatarCreator';
import ColorWheel from './components/ColorWheel';
import SettingsModal from './components/SettingsModal';
import VideoExportPage from './pages/VideoExportPage';
import './styles.css';

type ActiveView = 'builder' | 'chat' | 'story' | 'gallery' | 'export';
type InspectorSection = 'appearance' | 'clothing' | 'hair' | 'makeup' | 'body';

const ADULT_KEY = 'grok-girls-adult-v1';

export default function App() {
  const [girls, setGirls] = useState<Girl[]>(() => loadGirls(seedGirls));
  const [selectedId, setSelectedId] = useState<string>(seedGirls[0].id);
  const [view, setView] = useState<ActiveView>('builder');
  const [adult, setAdult] = useState(() => {
    try {
      return localStorage.getItem(ADULT_KEY) === '1';
    } catch {
      return true; // Default to mature aesthetic enabled
    }
  });

  // Active girl & draft
  const girl = useMemo(
    () => girls.find(g => g.id === selectedId) || girls[0] || seedGirls[0],
    [girls, selectedId]
  );

  const [draft, setDraft] = useState<AvatarDraft>(() => ({
    id: girl.id,
    name: girl.name,
    age: girl.age,
    gender: 'female',
    ethnicity: girl.ethnicity,
    bodyType: girl.bodyType,
    eyeColor: girl.eyeColor,
    eyeShape: girl.eyeShape,
    faceShape: girl.faceShape,
    hairColor: girl.hairColor,
    hairStyle: girl.hairStyle,
    skinTone: girl.skinTone,
    outfit: girl.outfit,
    pose: girl.pose,
    expression: girl.expression,
    extra: girl.extra,
    headShapeIndex: 4,
    colorAccent: girl.hairColor.includes('red') ? '#E62040' : '#904EDD',
    lipstickShade: 'bold ruby red satin',
    chokerStyle: 'ruby red velvet choker with gold medallion',
    hosieryStyle: 'sheer black fishnet stockings'
  }));

  // Sync draft when selected girl changes
  useEffect(() => {
    setDraft({
      id: girl.id,
      name: girl.name,
      age: girl.age,
      gender: 'female',
      ethnicity: girl.ethnicity,
      bodyType: girl.bodyType,
      eyeColor: girl.eyeColor,
      eyeShape: girl.eyeShape,
      faceShape: girl.faceShape,
      hairColor: girl.hairColor,
      hairStyle: girl.hairStyle,
      skinTone: girl.skinTone,
      outfit: girl.outfit,
      pose: girl.pose,
      expression: girl.expression,
      extra: girl.extra,
      headShapeIndex: 4,
      colorAccent: girl.hairColor.includes('red') ? '#E62040' : '#904EDD',
      lipstickShade: girl.id === 'ruby_noir' ? 'bold ruby red satin' : 'nude velvet matte',
      chokerStyle: girl.id === 'ruby_noir' ? 'ruby red velvet choker with gold medallion' : 'none',
      hosieryStyle: girl.id === 'ruby_noir' ? 'sheer black fishnet stockings' : 'bare legs'
    });
  }, [girl.id]);

  useEffect(() => {
    try {
      localStorage.setItem(ADULT_KEY, adult ? '1' : '0');
    } catch {}
  }, [adult]);

  // Inspector accordions
  const [openSections, setOpenSections] = useState<Record<InspectorSection, boolean>>({
    appearance: true,
    clothing: true,
    hair: false,
    makeup: false,
    body: false
  });

  const toggleSection = (s: InspectorSection) => {
    setOpenSections(prev => ({ ...prev, [s]: !prev[s] }));
  };

  // Viewport camera & lighting controls
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotationAngle, setRotationAngle] = useState(0);
  const [lightingMode, setLightingMode] = useState<'noir' | 'studio' | 'full' | 'bust' | 'wireframe'>('noir');

  // Lower dock sub-tab
  const [dockTab, setDockTab] = useState<'style' | 'color' | 'facial' | 'eyebrows'>('style');

  // State & story engines
  const [avatarState, setAvatarState] = useState<AvatarState>(() => loadAvatarState(girl.id, girl));
  const [story, setStory] = useState<StoryState>(() => initialStory(girl.affinity / 25));
  const [chat, setChat] = useState<ChatMessage[]>(() => loadChat(girl.id));
  const [chatInput, setChatInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const [gallery, setGallery] = useState<GalleryItem[]>(() => loadGallery());
  const [provider, setProvider] = useState<ProviderName>('local');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [saveToast, setSaveToast] = useState(false);

  // Active room
  const [roomId, setRoomId] = useState(rooms[0].id);
  const room: Room = useMemo(() => rooms.find(r => r.id === roomId) ?? rooms[0], [roomId]);

  const updateGirl = (patch: Partial<Girl>) => {
    const next = girls.map(g => (g.id === girl.id ? { ...g, ...patch } : g));
    setGirls(next);
    saveGirls(next);
    saveAvatar({ ...girl, ...patch });
  };

  const selectGirl = (id: string) => {
    const g = girls.find(x => x.id === id) || girls[0];
    setSelectedId(id);
    setChat(loadChat(id));
    setAvatarState(loadAvatarState(id, g));
    setStory(initialStory(g.affinity / 25));
    setResult('');
  };

  const handleCreateNewPreset = () => {
    const id = `custom_${Date.now()}`;
    const newGirl: Girl = {
      id,
      name: 'Goth Glamour AI',
      age: 24,
      ethnicity: 'caucasian',
      bodyType: 'hourglass',
      eyeColor: 'dark brown',
      eyeShape: 'almond',
      faceShape: 'oval',
      hairColor: 'vibrant ruby red',
      hairStyle: 'layered waves bob',
      skinTone: 'fair porcelain',
      outfit: 'red and black lace corset lingerie with matching satin panties, sheer black fishnet stockings, and ruby velvet choker',
      pose: 'sensually reclining back in dark leather armchair, hand on chest',
      expression: 'alluring parted lips and seductive gaze',
      extra: 'smokey dark eye makeup, bold crimson lipstick, dark leather armchair backdrop, sensual rim lighting',
      thumbnailUrl: '/assets/ruby-noir-thumb.jpg',
      previewUrl: '/assets/ruby-noir.jpg',
      bio: 'Sensual gothic glamour persona with fiery red waves, lace corsetry, and captivating charm.',
      traits: ['alluring', 'gothic', 'seductive'],
      room: 'Leather Armchair Lounge',
      affinity: 80,
      trust: 70,
      emotion: 'excited',
      memories: []
    };
    const next = [newGirl, ...girls];
    setGirls(next);
    saveGirls(next);
    selectGirl(id);
  };

  const handleRandomize = () => {
    const next = randomizeAvatar(draft);
    setDraft(next);
    updateGirl(next as Partial<Girl>);
  };

  const handleSaveAvatar = () => {
    updateGirl({
      name: draft.name,
      age: draft.age,
      ethnicity: draft.ethnicity,
      bodyType: draft.bodyType,
      eyeColor: draft.eyeColor,
      eyeShape: draft.eyeShape,
      faceShape: draft.faceShape,
      hairColor: draft.hairColor,
      hairStyle: draft.hairStyle,
      skinTone: draft.skinTone,
      outfit: draft.outfit,
      pose: draft.pose,
      expression: draft.expression,
      extra: draft.extra
    });
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  const copyAvatarId = () => {
    navigator.clipboard?.writeText(girl.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  };

  // Generation action
  const handleGenerate = async () => {
    setBusy(true);
    setResult('Synthesizing high-detail avatar render…');
    const promptCompiled = buildDraftPrompt(draft, adult);
    try {
      const r = await generateWithFallback(
        { prompt: promptCompiled, mode: 'image', width: 1024, height: 1024 },
        provider
      );
      if (r.assetUrl) {
        updateGirl({ previewUrl: r.assetUrl });
        addGalleryItem({
          avatarId: girl.id,
          mode: 'image',
          prompt: promptCompiled,
          assetUrl: r.assetUrl,
          provider: r.provider
        });
        setGallery(loadGallery());
      }
      setResult(r.text ?? r.warning ?? `Generation ready via ${r.provider}`);
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setBusy(false);
    }
  };

  // Chat action
  const sendChat = async () => {
    if (!chatInput.trim() || busy) return;
    const text = chatInput.trim();
    const now = Date.now();
    const user: ChatMessage = { id: String(now), role: 'user', text, createdAt: now };
    const next = [...chat, user];
    setChat(next);
    saveChat(girl.id, next);
    setChatInput('');
    setBusy(true);
    try {
      const answer = await reply(girl, room, next, text, provider, adult);
      const out: ChatMessage[] = [...next, { id: String(now + 1), role: 'assistant', text: answer, createdAt: now + 1 }];
      setChat(out);
      saveChat(girl.id, out);
      addMemory(girls, girl.id, 'Conversation', text, room.id);
      const nextAvatar = interactionState(avatarState);
      setAvatarState(nextAvatar);
      saveAvatarState(girl.id, nextAvatar);
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'Chat error');
    } finally {
      setBusy(false);
    }
  };

  // 8 Hair Style Silhouette Presets
  const hairStylePresets = [
    { label: 'Layered Waves', icon: '💇‍♀️', style: 'layered waves bob' },
    { label: 'Cyber Undercut', icon: '⚡', style: 'cyber undercut with side sweep' },
    { label: 'Glamour Waves', icon: '✨', style: 'long glamorous waves' },
    { label: 'Sleek Bob', icon: '🪞', style: 'sleek straight bob' },
    { label: 'High Ponytail', icon: '🎀', style: 'high ponytail' },
    { label: 'Messy Bun', icon: '🧶', style: 'messy bun with wisps' },
    { label: 'Pixie Crop', icon: '✂️', style: 'asymmetric pixie crop' },
    { label: 'Wet Waves', icon: '💧', style: 'wet-look waves' }
  ];

  // Skin tones
  const skinToneSwatches = [
    { name: 'Porcelain', color: '#fbe8df', tone: 'fair porcelain' },
    { name: 'Ivory', color: '#f5d6c6', tone: 'pale ivory' },
    { name: 'Warm Light', color: '#eec4a8', tone: 'light warm' },
    { name: 'Olive', color: '#d0a783', tone: 'olive' },
    { name: 'Golden Tan', color: '#b98758', tone: 'golden tan' },
    { name: 'Deep Bronze', color: '#885536', tone: 'deep bronze' },
    { name: 'Rich Espresso', color: '#4a2c1f', tone: 'rich espresso' },
    { name: 'Cyber Pale', color: '#d8e2eb', tone: 'cybernetic pale' }
  ];

  const currentPreviewUrl =
    girl.previewUrl ||
    (girl.id === 'ruby_noir'
      ? '/assets/ruby-noir.jpg'
      : girl.id === 'matrix_07'
      ? '/assets/matrix-07-center.jpg'
      : '/assets/ruby-noir.jpg');

  return (
    <div className="app-container">
      {/* 1. LEFT VERTICAL NAVIGATION RAIL */}
      <aside className="nav-rail">
        <div className="brand-logo" title="Grok Girls Studio">
          M
        </div>

        <div className="rail-menu">
          <button
            className={`rail-btn ${view === 'builder' ? 'active' : ''}`}
            onClick={() => setView('builder')}
            title="Appearance Studio"
          >
            <span className="rail-icon">💀</span>
            <span>Appearance</span>
          </button>

          <button
            className={`rail-btn ${openSections.body && view === 'builder' ? 'active' : ''}`}
            onClick={() => {
              setView('builder');
              setOpenSections(p => ({ ...p, body: true }));
            }}
            title="Body & Build"
          >
            <span className="rail-icon">👤</span>
            <span>Body</span>
          </button>

          <button
            className={`rail-btn ${openSections.clothing && view === 'builder' ? 'active' : ''}`}
            onClick={() => {
              setView('builder');
              setOpenSections(p => ({ ...p, clothing: true }));
            }}
            title="Lingerie & Corsetry"
          >
            <span className="rail-icon">👚</span>
            <span>Clothing</span>
          </button>

          <button
            className="rail-btn"
            onClick={() => {
              setView('builder');
              setDockTab('style');
            }}
            title="Hair Styling"
          >
            <span className="rail-icon">💇‍♀️</span>
            <span>Hair</span>
          </button>

          <button
            className={`rail-btn ${openSections.makeup && view === 'builder' ? 'active' : ''}`}
            onClick={() => {
              setView('builder');
              setOpenSections(p => ({ ...p, makeup: true }));
            }}
            title="Face & Makeup"
          >
            <span className="rail-icon">🎭</span>
            <span>Face</span>
          </button>

          <button
            className="rail-btn"
            onClick={() => {
              setView('builder');
              setOpenSections(p => ({ ...p, makeup: true }));
            }}
            title="Eyes & Eyeliner"
          >
            <span className="rail-icon">👁️</span>
            <span>Eyes</span>
          </button>

          <button
            className="rail-btn"
            onClick={() => {
              setView('builder');
              setOpenSections(p => ({ ...p, clothing: true }));
            }}
            title="Chokers & Accessories"
          >
            <span className="rail-icon">💍</span>
            <span>Accessories</span>
          </button>

          <button
            className="rail-btn"
            onClick={() => {
              setView('builder');
              setOpenSections(p => ({ ...p, appearance: true }));
            }}
            title="Augments"
          >
            <span className="rail-icon">⚡</span>
            <span>Augments</span>
          </button>

          <button
            className="rail-btn"
            onClick={() => {
              setView('builder');
              setOpenSections(p => ({ ...p, clothing: true }));
            }}
            title="Tattoos & Lace"
          >
            <span className="rail-icon">🖤</span>
            <span>Tattoos</span>
          </button>

          <button
            className={`rail-btn ${view === 'export' ? 'active' : ''}`}
            onClick={() => setView('export')}
            title="Video & Animation Studio"
          >
            <span className="rail-icon">🎬</span>
            <span>Animations</span>
          </button>
        </div>

        <div className="rail-footer">
          <button className="rail-btn" onClick={handleRandomize} title="Randomize Persona Traits">
            <span className="rail-icon">🎲</span>
          </button>

          <button className="rail-btn" onClick={() => setIsSettingsOpen(true)} title="AI Provider Settings">
            <span className="rail-icon">⚙️</span>
          </button>

          <button
            className={`rail-btn crown-btn ${adult ? 'adult-active' : ''}`}
            onClick={() => setAdult(v => !v)}
            title={adult ? 'Adult 18+ Mode ACTIVE' : 'Adult 18+ Mode OFF'}
          >
            <span className="rail-icon">👑</span>
            <span style={{ fontSize: 8 }}>{adult ? '18+ ON' : '18+'}</span>
          </button>

          <button className="rail-btn" onClick={() => setView('chat')} title="Interactive Dialogue">
            <span className="rail-icon">💬</span>
          </button>
        </div>
      </aside>

      {/* 2. PRESETS DRAWER (Column 2) */}
      <section className="presets-drawer">
        <div className="presets-header">
          <h3>Presets</h3>
          <button style={{ color: '#777' }} title="Filter presets">
            ⚙
          </button>
        </div>

        <div className="presets-list">
          {girls.map(g => (
            <button
              key={g.id}
              className={`preset-card ${g.id === selectedId ? 'active' : ''}`}
              onClick={() => selectGirl(g.id)}
            >
              <img
                src={
                  g.thumbnailUrl ||
                  (g.id === 'ruby_noir'
                    ? '/assets/ruby-noir-thumb.jpg'
                    : g.id === 'matrix_07'
                    ? '/assets/preset-1.jpg'
                    : '/assets/ruby-noir-thumb.jpg')
                }
                alt={g.name}
                className="preset-thumb"
              />
              <div className="preset-info">
                <div className="preset-name">{g.name}</div>
                <div className="preset-sub">
                  {g.id === 'ruby_noir'
                    ? 'Crimson Hair · Lace Corset'
                    : g.id === 'matrix_07'
                    ? 'Cyber Undercut · Techwear'
                    : g.outfit.slice(0, 24) + '…'}
                </div>
              </div>
            </button>
          ))}
        </div>

        <button className="btn-new-preset" onClick={handleCreateNewPreset}>
          + NEW PRESET
        </button>
      </section>

      {/* 3. CENTER VIEWPORT & LOWER DOCK */}
      <section className="center-workspace">
        {/* Viewport Header Bar */}
        <header className="viewport-header">
          <div className="avatar-design-title">
            <span>CREATE YOUR IDENTITY</span>
            <h2>Avatar Design</h2>
          </div>

          <div className="mode-pills">
            <button
              className={`mode-pill ${view === 'builder' ? 'active' : ''}`}
              onClick={() => setView('builder')}
            >
              BUILDER
            </button>
            <button
              className={`mode-pill ${view === 'chat' ? 'active' : ''}`}
              onClick={() => setView('chat')}
            >
              COMPANION CHAT
            </button>
            <button
              className={`mode-pill ${view === 'story' ? 'active' : ''}`}
              onClick={() => setView('story')}
            >
              STORY
            </button>
            <button
              className={`mode-pill ${view === 'export' ? 'active' : ''}`}
              onClick={() => setView('export')}
            >
              VIDEO
            </button>
            <button
              className={`mode-pill ${view === 'gallery' ? 'active' : ''}`}
              onClick={() => setView('gallery')}
            >
              GALLERY
            </button>
          </div>

          <div className="viewport-tools-top">
            <button
              className="icon-tool-btn"
              onClick={() => setZoomLevel(1)}
              title="Reset View"
            >
              ↺
            </button>
            <button
              className="icon-tool-btn"
              onClick={() => setZoomLevel(z => Math.min(1.8, z + 0.15))}
              title="Zoom In"
            >
              +
            </button>
            <button
              className="icon-tool-btn"
              onClick={() => setZoomLevel(z => Math.max(0.7, z - 0.15))}
              title="Zoom Out"
            >
              −
            </button>
            <button
              className="icon-tool-btn"
              onClick={() => setIsSettingsOpen(true)}
              title="Provider Settings"
            >
              ⋮
            </button>
          </div>
        </header>

        {/* Viewport Canvas Stage */}
        <div className="viewport-stage">
          <div className="character-render-wrap">
            <img
              src={currentPreviewUrl}
              alt={girl.name}
              className="character-image"
              style={{
                transform: `scale(${zoomLevel}) rotate(${rotationAngle}deg)`,
                filter:
                  lightingMode === 'noir'
                    ? 'contrast(1.15) brightness(1.02) drop-shadow(0 0 35px rgba(230, 32, 64, 0.35))'
                    : lightingMode === 'wireframe'
                    ? 'invert(1) hue-rotate(180deg)'
                    : 'drop-shadow(0 20px 40px rgba(0,0,0,0.85))'
              }}
            />

            <div className="character-tag">
              {girl.id === 'ruby_noir'
                ? 'RUBY_NOIR_01'
                : girl.id === 'matrix_07'
                ? 'MATRIX_07'
                : girl.name.toUpperCase().replace(/\s+/g, '_')}
            </div>
          </div>

          {/* Viewport Top Right HUD */}
          <div className="viewport-hud">
            <button
              className="hud-btn"
              onClick={() => setRotationAngle(r => (r + 45) % 360)}
              title="Rotate Viewport Angle"
            >
              <span>R</span> ROTATE
            </button>
            <button
              className="hud-btn"
              onClick={() => setZoomLevel(z => (z > 1.2 ? 1 : 1.4))}
              title="Toggle Zoom"
            >
              <span>🔍</span> ZOOM
            </button>
            <button
              className="hud-btn"
              onClick={() => {
                setZoomLevel(1);
                setRotationAngle(0);
              }}
              title="Center Pan"
            >
              <span>✥</span> PAN
            </button>
            <button className="hud-btn" onClick={handleRandomize} title="Randomize Attributes">
              <span>🎲</span> RANDOM
            </button>
          </div>

          {/* Viewport Bottom Lighting / Camera Bar */}
          <div className="viewport-lighting-bar">
            <button
              className={`lighting-btn ${lightingMode === 'studio' ? 'active' : ''}`}
              onClick={() => setLightingMode('studio')}
              title="Studio Softbox Keylight"
            >
              ☀️
            </button>
            <button
              className={`lighting-btn ${lightingMode === 'noir' ? 'active' : ''}`}
              onClick={() => setLightingMode('noir')}
              title="Gothic Noir Armchair Shadows (Picture 1 Mood)"
            >
              💀
            </button>
            <button
              className={`lighting-btn ${lightingMode === 'full' ? 'active' : ''}`}
              onClick={() => {
                setLightingMode('full');
                setZoomLevel(0.85);
              }}
              title="Full-Length Framing"
            >
              🧍
            </button>
            <button
              className={`lighting-btn ${lightingMode === 'bust' ? 'active' : ''}`}
              onClick={() => {
                setLightingMode('bust');
                setZoomLevel(1.35);
              }}
              title="Bust & Face Portrait"
            >
              👤
            </button>
            <button
              className={`lighting-btn ${lightingMode === 'wireframe' ? 'active' : ''}`}
              onClick={() => setLightingMode(m => (m === 'wireframe' ? 'noir' : 'wireframe'))}
              title="3D Depth Wireframe"
            >
              🧊
            </button>
          </div>
        </div>

        {/* Lower Tool Dock (Hair, Color Wheel, Add-ons, Angle Previews) */}
        <div className="lower-dock">
          {/* Left: Hair & Color Wheel */}
          <div className="dock-hair-section">
            <div className="dock-tabs">
              <button
                className={`dock-tab ${dockTab === 'style' ? 'active' : ''}`}
                onClick={() => setDockTab('style')}
              >
                HAIR STYLE
              </button>
              <button
                className={`dock-tab ${dockTab === 'color' ? 'active' : ''}`}
                onClick={() => setDockTab('color')}
              >
                HAIR COLOR
              </button>
              <button
                className={`dock-tab ${dockTab === 'facial' ? 'active' : ''}`}
                onClick={() => setDockTab('facial')}
              >
                CHOKERS & LIPS
              </button>
              <button
                className={`dock-tab ${dockTab === 'eyebrows' ? 'active' : ''}`}
                onClick={() => setDockTab('eyebrows')}
              >
                EYEBROWS
              </button>
            </div>

            <div className="dock-hair-content">
              {/* 8 Hair Style Cards */}
              <div className="hair-styles-grid">
                {hairStylePresets.map(h => (
                  <button
                    key={h.style}
                    className={`hair-style-card ${draft.hairStyle === h.style ? 'active' : ''}`}
                    onClick={() => setDraft(d => ({ ...d, hairStyle: h.style }))}
                    title={h.label}
                  >
                    <span>{h.icon}</span>
                  </button>
                ))}
              </div>

              {/* Functional Color Wheel */}
              <ColorWheel
                color={draft.colorAccent || (draft.hairColor.includes('red') ? '#E62040' : '#904EDD')}
                onChange={hex => {
                  setDraft(d => ({
                    ...d,
                    colorAccent: hex,
                    hairColor: hex === '#E62040' ? 'vibrant ruby red' : hex === '#904EDD' ? 'electric purple' : 'custom dyed'
                  }));
                }}
                accentColors={['#E62040', '#904EDD', '#00F2FE', '#1F2430', '#F5F5FA']}
              />
            </div>
          </div>

          {/* Middle: Details & Add-Ons */}
          <div className="dock-addons-section">
            <div className="dock-section-title">DETAILS & ADD-ONS</div>
            <div className="addons-grid">
              <div
                className="addon-card active"
                onClick={() => {
                  setDraft(d => ({
                    ...d,
                    chokerStyle:
                      d.chokerStyle === 'ruby red velvet choker with gold medallion'
                        ? 'black lace ribbon choker'
                        : 'ruby red velvet choker with gold medallion'
                  }));
                }}
              >
                <div className="addon-icon">💎</div>
                <div className="addon-title">CHOKER</div>
                <div className="addon-count">08 / 24</div>
              </div>

              <div
                className="addon-card active"
                onClick={() => {
                  setDraft(d => ({
                    ...d,
                    outfit:
                      d.outfit.includes('corset')
                        ? 'black satin bustier with floral lace trim'
                        : 'red and black lace corset lingerie with matching satin panties, sheer fishnet stockings, and ruby velvet choker'
                  }));
                }}
              >
                <div className="addon-icon">🩱</div>
                <div className="addon-title">CORSET</div>
                <div className="addon-count">16 / 35</div>
              </div>

              <div
                className="addon-card active"
                onClick={() => {
                  setDraft(d => ({
                    ...d,
                    hosieryStyle:
                      d.hosieryStyle === 'sheer black fishnet stockings'
                        ? 'black lace-top thigh-high stockings'
                        : 'sheer black fishnet stockings'
                  }));
                }}
              >
                <div className="addon-icon">🕸️</div>
                <div className="addon-title">FISHNETS</div>
                <div className="addon-count">06 / 18</div>
              </div>

              <div className="addon-card">
                <div className="addon-icon">👂</div>
                <div className="addon-title">PIERCINGS</div>
                <div className="addon-count">12 / 32</div>
              </div>

              <div className="addon-card">
                <div className="addon-icon">💄</div>
                <div className="addon-title">MAKEUP</div>
                <div className="addon-count">14 / 28</div>
              </div>

              <div className="addon-card">
                <div className="addon-icon">⚡</div>
                <div className="addon-title">CYBER</div>
                <div className="addon-count">15 / 40</div>
              </div>
            </div>
          </div>

          {/* Right: Multi-Angle Preview */}
          <div className="dock-preview-section">
            <div className="preview-camera-icons">
              <span className="active" title="Front">🧍</span>
              <span title="Torso">👤</span>
              <span title="Close-up">🔍</span>
              <span title="Back">🪞</span>
            </div>

            <div className="preview-circles-row">
              <div
                className="preview-circle active"
                onClick={() => setZoomLevel(1.3)}
                title="Front Portrait"
              >
                <img
                  src={
                    girl.id === 'ruby_noir'
                      ? '/assets/ruby-noir-thumb.jpg'
                      : '/assets/preset-1.jpg'
                  }
                  alt="Front Angle"
                />
              </div>

              <div
                className="preview-circle"
                onClick={() => setZoomLevel(1)}
                title="3/4 Reclining Armchair Angle (Picture 1)"
              >
                <img
                  src={
                    girl.id === 'ruby_noir'
                      ? '/assets/ruby-noir.jpg'
                      : '/assets/matrix-07-center.jpg'
                  }
                  alt="3/4 Angle"
                />
              </div>

              <div
                className="preview-circle"
                onClick={() => setRotationAngle(180)}
                title="Back Silhouette"
              >
                <img
                  src={
                    girl.id === 'ruby_noir'
                      ? '/assets/ruby-noir-thumb.jpg'
                      : '/assets/preset-4.jpg'
                  }
                  alt="Back Angle"
                />
              </div>
            </div>
          </div>
        </div>

        {/* COMPANION CHAT OVERLAY VIEW */}
        {view === 'chat' && (
          <div className="companion-overlay-dock">
            <div className="companion-header">
              <div>
                <h3 style={{ margin: 0, color: '#fff', fontSize: 16 }}>
                  Dialogue with {girl.name}
                </h3>
                <span style={{ fontSize: 11, color: '#aaa' }}>
                  {girl.room} · {girl.emotion} mood · {Math.round(avatarState.affection)}% affection
                </span>
              </div>
              <button
                style={{ color: '#aaa', fontSize: 16 }}
                onClick={() => setView('builder')}
              >
                ✕ Close Chat
              </button>
            </div>

            <div className="companion-log">
              {chat.length === 0 ? (
                <div style={{ color: '#777', textAlign: 'center', margin: 'auto' }}>
                  Say hello to {girl.name} to begin your conversation…
                </div>
              ) : (
                chat.map(m => (
                  <div key={m.id} className={`chat-bubble ${m.role}`}>
                    <span className="chat-author">
                      {m.role === 'user' ? 'YOU' : girl.name.toUpperCase()}
                    </span>
                    {m.text}
                  </div>
                ))
              )}
            </div>

            <div className="companion-input-row">
              <input
                className="companion-input"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
                placeholder={`Talk to ${girl.name}…`}
              />
              <button className="btn-send-chat" disabled={busy} onClick={sendChat}>
                {busy ? '…' : 'SEND'}
              </button>
            </div>
          </div>
        )}

        {/* STORY OVERLAY VIEW */}
        {view === 'story' && (
          <div className="companion-overlay-dock">
            <div className="companion-header">
              <div>
                <h3 style={{ margin: 0, color: '#fff', fontSize: 16 }}>
                  Campaign: Chapter {story.chapter} - {story.title}
                </h3>
                <span style={{ fontSize: 11, color: '#aaa' }}>
                  Objective: {story.objective} · Relationship Level {story.relationshipLevel}
                </span>
              </div>
              <button style={{ color: '#aaa', fontSize: 16 }} onClick={() => setView('builder')}>
                ✕
              </button>
            </div>

            <div style={{ padding: 18, background: '#12121e', borderRadius: 12, border: '1px solid #232338', marginBottom: 14 }}>
              <p style={{ color: '#ccc', lineHeight: 1.6 }}>{storyPrompt(story)}</p>
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                {storyChapters.map(c => (
                  <div
                    key={c.chapter}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: c.chapter === story.chapter ? '#281f44' : '#171726',
                      border: c.chapter === story.chapter ? '1px solid #904edd' : '1px solid #252538',
                      color: c.chapter === story.chapter ? '#fff' : '#888'
                    }}
                  >
                    <b>Ch {c.chapter}</b>: {c.title}
                  </div>
                ))}
              </div>
            </div>

            <button
              className="btn-generate-media"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => setStory(s => advanceStory(s, s.relationshipLevel + 1))}
            >
              Advance Story Chapter
            </button>
          </div>
        )}

        {/* VIDEO EXPORT OVERLAY VIEW */}
        {view === 'export' && (
          <div className="companion-overlay-dock" style={{ padding: 0 }}>
            <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e1e2d' }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>Video Render Studio</h3>
              <button onClick={() => setView('builder')}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              <VideoExportPage
                girl={girl}
                room={room}
                latestAssetUrl={currentPreviewUrl}
                adult={adult}
              />
            </div>
          </div>
        )}

        {/* GALLERY OVERLAY VIEW */}
        {view === 'gallery' && (
          <div className="companion-overlay-dock">
            <div className="companion-header">
              <h3 style={{ margin: 0, color: '#fff', fontSize: 16 }}>
                Generation Archive ({gallery.length})
              </h3>
              <button onClick={() => setView('builder')}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
              {gallery.map(item => (
                <div
                  key={item.id}
                  style={{ background: '#12121e', border: '1px solid #232338', borderRadius: 10, padding: 10 }}
                >
                  <img
                    src={item.assetUrl}
                    alt="Generation"
                    style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8 }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                    <button onClick={() => setGallery(toggleFavorite(item.id))}>
                      {item.favorite ? '★' : '☆'}
                    </button>
                    {item.assetUrl && (
                      <button onClick={() => downloadMedia(item.assetUrl!, `${item.id}.png`)}>
                        Export
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 4. RIGHT CUSTOMIZATION ACCORDION PANEL (Matching Picture 2) */}
      <aside className="inspector-panel">
        <div className="inspector-scroll">
          {/* Section: APPEARANCE */}
          <div className="accordion-item">
            <button className="accordion-trigger" onClick={() => toggleSection('appearance')}>
              <span>Appearance</span>
              <span className={`accordion-chevron ${openSections.appearance ? 'open' : ''}`}>▼</span>
            </button>

            {openSections.appearance && (
              <div className="accordion-body">
                {/* Gender Selector (4 pills matching Picture 2) */}
                <div className="inspector-label">
                  <span>Gender</span>
                  <div className="gender-selector">
                    <button
                      className={`gender-btn ${draft.gender === 'male' ? 'active' : ''}`}
                      onClick={() => setDraft(d => ({ ...d, gender: 'male' }))}
                      title="Male"
                    >
                      ♂
                    </button>
                    <button
                      className={`gender-btn ${draft.gender === 'female' ? 'active' : ''}`}
                      onClick={() => setDraft(d => ({ ...d, gender: 'female' }))}
                      title="Female"
                    >
                      ♀
                    </button>
                    <button
                      className={`gender-btn ${draft.gender === 'nonbinary' ? 'active' : ''}`}
                      onClick={() => setDraft(d => ({ ...d, gender: 'nonbinary' }))}
                      title="Non-Binary"
                    >
                      ⚧
                    </button>
                    <button
                      className={`gender-btn ${draft.gender === 'android' ? 'active' : ''}`}
                      onClick={() => setDraft(d => ({ ...d, gender: 'android' }))}
                      title="Android / Cyber"
                    >
                      🤖
                    </button>
                  </div>
                </div>

                {/* Skin Tone Swatches (8 circles matching Picture 2) */}
                <div className="inspector-label">
                  <span>Skin Tone</span>
                  <div className="skintone-swatches">
                    {skinToneSwatches.map(s => (
                      <div
                        key={s.tone}
                        className={`skintone-dot ${draft.skinTone === s.tone ? 'active' : ''}`}
                        style={{ backgroundColor: s.color }}
                        onClick={() => setDraft(d => ({ ...d, skinTone: s.tone }))}
                        title={s.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Head Shape Slider */}
                <div className="inspector-label">
                  <div className="slider-stepper-row">
                    <span>Head Shape</span>
                    <span className="stepper-val">&lt; 0{draft.headShapeIndex || 4} / 12 &gt;</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={12}
                    value={draft.headShapeIndex || 4}
                    onChange={e => setDraft(d => ({ ...d, headShapeIndex: Number(e.target.value) }))}
                    className="slider-track"
                  />
                </div>

                {/* Age Slider */}
                <div className="inspector-label">
                  <div className="slider-stepper-row">
                    <span>Age</span>
                    <span className="stepper-val">{draft.age}</span>
                  </div>
                  <input
                    type="range"
                    min={18}
                    max={60}
                    value={draft.age}
                    onChange={e => setDraft(d => ({ ...d, age: Number(e.target.value) }))}
                    className="slider-track"
                  />
                </div>

                {/* Skin Details Avatars */}
                <div className="inspector-label">
                  <span>Skin Details</span>
                  <div className="skin-details-grid">
                    {['Glow', 'Porcelain', 'Freckles', 'Matte'].map(sd => (
                      <button
                        key={sd}
                        className={`skin-detail-card ${draft.extra?.includes(sd.toLowerCase()) ? 'active' : ''}`}
                        onClick={() =>
                          setDraft(d => ({
                            ...d,
                            extra: d.extra ? `${d.extra}, ${sd.toLowerCase()} skin` : `${sd.toLowerCase()} skin`
                          }))
                        }
                      >
                        {sd}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Accent */}
                <div className="accent-row">
                  <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)' }}>
                    COLOR ACCENT
                  </span>
                  <div
                    className="accent-circle-dot"
                    style={{
                      backgroundColor: draft.colorAccent || '#904EDD',
                      boxShadow: `0 0 10px ${draft.colorAccent || '#904EDD'}`
                    }}
                    onClick={() => {
                      setDockTab('color');
                    }}
                    title="Click to tune in color wheel"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section: CLOTHING & LINGERIE (Crucial for Picture 1!) */}
          <div className="accordion-item">
            <button className="accordion-trigger" onClick={() => toggleSection('clothing')}>
              <span>Clothing & Lingerie</span>
              <span className={`accordion-chevron ${openSections.clothing ? 'open' : ''}`}>▼</span>
            </button>

            {openSections.clothing && (
              <div className="accordion-body">
                <label className="inspector-label">
                  <span>Corset & Lingerie Style</span>
                  <select
                    className="inspector-select"
                    value={draft.outfit}
                    onChange={e => setDraft(d => ({ ...d, outfit: e.target.value }))}
                  >
                    {avatarOptions.outfit.map(o => (
                      <option key={o} value={o}>
                        {o.slice(0, 42)}…
                      </option>
                    ))}
                  </select>
                </label>

                <label className="inspector-label">
                  <span>Neckwear & Choker</span>
                  <select
                    className="inspector-select"
                    value={draft.chokerStyle || 'ruby red velvet choker with gold medallion'}
                    onChange={e => setDraft(d => ({ ...d, chokerStyle: e.target.value }))}
                  >
                    {avatarOptions.chokerStyle.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="inspector-label">
                  <span>Hosiery & Stockings</span>
                  <select
                    className="inspector-select"
                    value={draft.hosieryStyle || 'sheer black fishnet stockings'}
                    onChange={e => setDraft(d => ({ ...d, hosieryStyle: e.target.value }))}
                  >
                    {avatarOptions.hosieryStyle.map(h => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="inspector-label">
                  <span>Environment Backdrop</span>
                  <select
                    className="inspector-select"
                    value={roomId}
                    onChange={e => setRoomId(e.target.value)}
                  >
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>

          {/* Section: HAIR */}
          <div className="accordion-item">
            <button className="accordion-trigger" onClick={() => toggleSection('hair')}>
              <span>Hair & Color</span>
              <span className={`accordion-chevron ${openSections.hair ? 'open' : ''}`}>▼</span>
            </button>

            {openSections.hair && (
              <div className="accordion-body">
                <label className="inspector-label">
                  <span>Hair Style</span>
                  <select
                    className="inspector-select"
                    value={draft.hairStyle}
                    onChange={e => setDraft(d => ({ ...d, hairStyle: e.target.value }))}
                  >
                    {avatarOptions.hairStyle.map(h => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="inspector-label">
                  <span>Hair Color</span>
                  <select
                    className="inspector-select"
                    value={draft.hairColor}
                    onChange={e => setDraft(d => ({ ...d, hairColor: e.target.value }))}
                  >
                    {avatarOptions.hairColor.map(hc => (
                      <option key={hc} value={hc}>
                        {hc}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>

          {/* Section: MAKEUP & FACE */}
          <div className="accordion-item">
            <button className="accordion-trigger" onClick={() => toggleSection('makeup')}>
              <span>Eyes & Makeup</span>
              <span className={`accordion-chevron ${openSections.makeup ? 'open' : ''}`}>▼</span>
            </button>

            {openSections.makeup && (
              <div className="accordion-body">
                <label className="inspector-label">
                  <span>Lipstick Shade</span>
                  <select
                    className="inspector-select"
                    value={draft.lipstickShade || 'bold ruby red satin'}
                    onChange={e => setDraft(d => ({ ...d, lipstickShade: e.target.value }))}
                  >
                    {avatarOptions.lipstickShade.map(ls => (
                      <option key={ls} value={ls}>
                        {ls}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="inspector-label">
                  <span>Eye Color</span>
                  <select
                    className="inspector-select"
                    value={draft.eyeColor}
                    onChange={e => setDraft(d => ({ ...d, eyeColor: e.target.value }))}
                  >
                    {avatarOptions.eyeColor.map(ec => (
                      <option key={ec} value={ec}>
                        {ec}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="inspector-label">
                  <span>Expression</span>
                  <select
                    className="inspector-select"
                    value={draft.expression}
                    onChange={e => setDraft(d => ({ ...d, expression: e.target.value }))}
                  >
                    {avatarOptions.expression.map(ex => (
                      <option key={ex} value={ex}>
                        {ex}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>

          {/* Section: BODY & POSE */}
          <div className="accordion-item">
            <button className="accordion-trigger" onClick={() => toggleSection('body')}>
              <span>Body & Pose</span>
              <span className={`accordion-chevron ${openSections.body ? 'open' : ''}`}>▼</span>
            </button>

            {openSections.body && (
              <div className="accordion-body">
                <label className="inspector-label">
                  <span>Body Build</span>
                  <select
                    className="inspector-select"
                    value={draft.bodyType}
                    onChange={e => setDraft(d => ({ ...d, bodyType: e.target.value }))}
                  >
                    {avatarOptions.bodyType.map(bt => (
                      <option key={bt} value={bt}>
                        {bt}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="inspector-label">
                  <span>Pose & Reclining Angle</span>
                  <select
                    className="inspector-select"
                    value={draft.pose}
                    onChange={e => setDraft(d => ({ ...d, pose: e.target.value }))}
                  >
                    {avatarOptions.pose.map(p => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* 5. BOTTOM MASTER FOOTER BAR (Matching Picture 2) */}
      <footer className="master-footer">
        <div className="footer-left">
          <div className="avatar-id-tag">
            <span>AVATAR ID</span>
            <b style={{ color: '#fff' }}>
              {girl.id === 'ruby_noir'
                ? 'RUBY_NOIR_9X4C'
                : girl.id === 'matrix_07'
                ? 'MATRIX_07_8X9A'
                : `${girl.name.toUpperCase().replace(/\s+/g, '_')}_ID`}
            </b>
            <button onClick={copyAvatarId} title="Copy Avatar ID">
              {copiedId ? '✓' : '⎘'}
            </button>
          </div>

          <button className="btn-load-outfit" onClick={handleRandomize}>
            <span>👚</span> LOAD OUTFIT
          </button>
        </div>

        <div className="footer-right">
          {saveToast && (
            <span style={{ color: '#7ff0bd', fontSize: 12, fontWeight: 700 }}>
              ✓ Avatar identity saved!
            </span>
          )}

          <button className="btn-cancel" onClick={() => setView('builder')}>
            CANCEL
          </button>

          <button
            className="btn-generate-media"
            disabled={busy}
            onClick={handleGenerate}
          >
            {busy ? 'RENDERING…' : '✨ GENERATE RENDER'}
          </button>

          <div className="split-save-btn">
            <button className="save-main-btn" onClick={handleSaveAvatar}>
              SAVE AVATAR
            </button>
            <button className="save-arrow-btn" onClick={() => setView('gallery')}>
              ▼
            </button>
          </div>
        </div>
      </footer>

      {/* SETTINGS MODAL */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
