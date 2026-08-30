import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Girl, rooms, seedGirls, Room } from './models/studio';
import { advanceStory, initialStory, StoryState, storyChapters, storyPrompt } from './models/story';
import { addMemory, buildGenerationPrompt, loadGirls, saveGirls } from './services/memory';
import { AvatarState, interactionState, loadAvatarState, saveAvatarState, statePrompt } from './services/avatarState';
import { addGalleryItem, loadGallery, removeGalleryItem, toggleFavorite, GalleryItem } from './services/gallery';
import { generateWithFallback, ProviderName } from './services/providers';
import { getServerBase } from './services/selfHosted';
import { ChatMessage, loadChat, reply, saveChat } from './services/chat';
import { saveAvatar } from './services/avatarEditor';
import { downloadMedia, exportGallery, importGallery } from './services/media';
import {
  AvatarDraft,
  avatarOptions,
  randomizeAvatar,
  buildDraftPrompt,
  loadDraft,
  saveDraft
} from './services/avatarCreator';
import { redirectToPaymentLink } from './services/stripe';
import { StylePreset, applyStylePreset, stylePresets } from './services/styles';
import { StudioStats, achievements, bumpStat, loadStats } from './services/stats';
import ColorWheel from './components/ColorWheel';
import SettingsModal from './components/SettingsModal';
import VideoExportPage from './pages/VideoExportPage';
import './styles.css';

type ActiveView = 'builder' | 'presets' | 'import' | 'chat' | 'story' | 'video' | 'gallery';
type InspectorSection =
  | 'appearance'
  | 'hair'
  | 'eyes'
  | 'face'
  | 'body'
  | 'clothing'
  | 'tattoos'
  | 'augments';
type DockTab = 'style' | 'color' | 'makeup' | 'eyebrows' | 'scene';

const ADULT_KEY = 'grok-girls-adult-v1';

function defaultDraft(g: Girl): AvatarDraft {
  return {
    id: g.id,
    name: g.name,
    age: g.age,
    gender: 'female',
    ethnicity: g.ethnicity,
    bodyType: g.bodyType,
    eyeColor: g.eyeColor,
    eyeShape: g.eyeShape,
    faceShape: g.faceShape,
    hairColor: g.hairColor,
    hairStyle: g.hairStyle,
    skinTone: g.skinTone,
    outfit: g.outfit,
    pose: g.pose,
    expression: g.expression,
    extra: g.extra,
    headShapeIndex: 4,
    colorAccent: g.hairColor.includes('red')
      ? '#E62040'
      : g.hairColor.includes('purple')
      ? '#904EDD'
      : '#00F2FE',
    makeupStyle: 'dark smokey eyeshadow with winged eyeliner',
    lipstickShade: g.id === 'ruby_noir' ? 'bold ruby red satin' : 'nude velvet matte',
    chokerStyle: g.id === 'ruby_noir' ? 'ruby red velvet choker with gold medallion' : 'none',
    hosieryStyle: g.id === 'ruby_noir' ? 'sheer black fishnet stockings' : 'bare legs',
    chairSetting: avatarOptions.chairSetting[0],
    tattooStyle: 'none',
    augmentStyle: 'none',
    scarStyle: 'none',
    facePaintStyle: 'none',
    browShape: 'arched',
    browThickness: 3,
    piercingsCount: 0,
    tattoosCount: 0
  };
}

const draftToGirlPatch = (d: AvatarDraft): Partial<Girl> => ({
  name: d.name,
  age: d.age,
  ethnicity: d.ethnicity,
  bodyType: d.bodyType,
  eyeColor: d.eyeColor,
  eyeShape: d.eyeShape,
  faceShape: d.faceShape,
  hairColor: d.hairColor,
  hairStyle: d.hairStyle,
  skinTone: d.skinTone,
  outfit: d.outfit,
  pose: d.pose,
  expression: d.expression,
  extra: d.extra
});

function cycleOption<T>(list: readonly T[], current: T | undefined): T {
  const idx = list.indexOf(current as T);
  return list[(idx + 1) % list.length];
}

export default function App() {
  /* ------------------------------------------------------------ state */
  const [girls, setGirls] = useState<Girl[]>(() => loadGirls(seedGirls));
  const [selectedId, setSelectedId] = useState<string>(
    () => (loadGirls(seedGirls)[0] || seedGirls[0]).id
  );
  const [view, setView] = useState<ActiveView>('builder');
  const [adult, setAdult] = useState(() => {
    try {
      return localStorage.getItem(ADULT_KEY) === '1';
    } catch {
      return true;
    }
  });

  const girl = useMemo(
    () => girls.find(g => g.id === selectedId) || girls[0] || seedGirls[0],
    [girls, selectedId]
  );

  const [draft, setDraft] = useState<AvatarDraft>(() => loadDraft(girl.id, defaultDraft(girl)));

  // Sync draft when the selected persona changes
  useEffect(() => {
    suppressHistoryRef.current = true;
    setDraft(loadDraft(girl.id, defaultDraft(girl)));
  }, [girl.id]);

  // Persist draft + adult flag
  useEffect(() => {
    saveDraft(draft);
  }, [draft]);

  // Undo / redo history for the draft
  const historyRef = useRef<AvatarDraft[]>([]);
  const futureRef = useRef<AvatarDraft[]>([]);
  const suppressHistoryRef = useRef(false);
  const lastDraftRef = useRef<AvatarDraft>(draft);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    const prev = lastDraftRef.current;
    if (prev === draft) return;
    if (suppressHistoryRef.current) {
      suppressHistoryRef.current = false;
      lastDraftRef.current = draft;
      return;
    }
    if (prev.id === draft.id) {
      historyRef.current.push(prev);
      if (historyRef.current.length > 80) historyRef.current.shift();
      futureRef.current = [];
      setCanUndo(true);
      setCanRedo(false);
    } else {
      historyRef.current = [];
      futureRef.current = [];
      setCanUndo(false);
      setCanRedo(false);
    }
    lastDraftRef.current = draft;
  }, [draft]);

  const undoDraft = () => {
    const prev = historyRef.current.pop();
    if (!prev) return;
    futureRef.current.push(draft);
    suppressHistoryRef.current = true;
    lastDraftRef.current = prev;
    setDraft(prev);
    setCanUndo(historyRef.current.length > 0);
    setCanRedo(true);
  };

  const redoDraft = () => {
    const next = futureRef.current.pop();
    if (!next) return;
    historyRef.current.push(draft);
    suppressHistoryRef.current = true;
    lastDraftRef.current = next;
    setDraft(next);
    setCanRedo(futureRef.current.length > 0);
    setCanUndo(true);
  };

  useEffect(() => {
    try {
      localStorage.setItem(ADULT_KEY, adult ? '1' : '0');
    } catch {}
  }, [adult]);



  /* -------------------------------------------------------- accordions */
  const [openSections, setOpenSections] = useState<Record<InspectorSection, boolean>>({
    appearance: true,
    hair: false,
    eyes: false,
    face: false,
    body: false,
    clothing: false,
    tattoos: false,
    augments: false
  });

  const toggleSection = (s: InspectorSection) => {
    setOpenSections(prev => ({ ...prev, [s]: !prev[s] }));
  };

  /* --------------------------------------------- viewport & lighting */
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotationAngle, setRotationAngle] = useState(0);
  const [lightingMode, setLightingMode] = useState<'noir' | 'studio' | 'full' | 'bust' | 'wireframe'>(
    'noir'
  );
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const onStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    setPanning(true);
  };
  const onStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!panStart.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setPan({
      x: Math.max(-170, Math.min(170, panStart.current.px + dx)),
      y: Math.max(-130, Math.min(130, panStart.current.py + dy))
    });
  };
  const onStagePointerEnd = () => {
    panStart.current = null;
    setPanning(false);
  };

  const resetCamera = () => {
    setZoomLevel(1);
    setRotationAngle(0);
    setPan({ x: 0, y: 0 });
  };

  /* ------------------------------------------------------ dock / misc */
  const [dockTab, setDockTab] = useState<DockTab>('style');
  const [avatarState, setAvatarState] = useState<AvatarState>(() => loadAvatarState(girl.id, girl));
  const [story, setStory] = useState<StoryState>(() => initialStory(girl.affinity / 25));
  const [chat, setChat] = useState<ChatMessage[]>(() => loadChat(girl.id));
  const [chatInput, setChatInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const [gallery, setGallery] = useState<GalleryItem[]>(() => loadGallery());
  const [galleryFilter, setGalleryFilter] = useState<'all' | 'local' | 'openrouter' | 'gemini' | 'custom' | 'selfhosted'>('all');
  const [deleteArmedId, setDeleteArmedId] = useState<string | null>(null);
  const personaImportRef = useRef<HTMLInputElement>(null);
  const [provider, setProvider] = useState<ProviderName>(() => {
    try {
      const v = localStorage.getItem('grok-girls-provider-v1');
      if (v === 'local' || v === 'openrouter' || v === 'gemini' || v === 'custom' || v === 'selfhosted')
        return v;
    } catch {}
    return 'local';
  });
  useEffect(() => {
    try {
      localStorage.setItem('grok-girls-provider-v1', provider);
    } catch {}
  }, [provider]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [styleFilter, setStyleFilter] = useState<string | null>(null);
  const [variations, setVariations] = useState<{ url?: string; provider: string; prompt: string }[]>([]);
  const [variationsOpen, setVariationsOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [immersive, setImmersive] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState(() => {
    try {
      return localStorage.getItem('grok-girls-neg-v1') || '';
    } catch {
      return '';
    }
  });
  const [seedInput, setSeedInput] = useState(() => {
    try {
      return localStorage.getItem('grok-girls-seed-v1') || '';
    } catch {
      return '';
    }
  });
  const [stepsInput, setStepsInput] = useState(() => {
    try {
      return Number(localStorage.getItem('grok-girls-steps-v1')) || 28;
    } catch {
      return 28;
    }
  });
  const [cfgInput, setCfgInput] = useState(() => {
    try {
      return Number(localStorage.getItem('grok-girls-cfg-v1')) || 7;
    } catch {
      return 7;
    }
  });
  const [renderSize, setRenderSize] = useState(() => {
    try {
      return Number(localStorage.getItem('grok-girls-size-v1')) || 1024;
    } catch {
      return 1024;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('grok-girls-neg-v1', negativePrompt);
      localStorage.setItem('grok-girls-seed-v1', seedInput);
      localStorage.setItem('grok-girls-steps-v1', String(stepsInput));
      localStorage.setItem('grok-girls-cfg-v1', String(cfgInput));
      localStorage.setItem('grok-girls-size-v1', String(renderSize));
    } catch {}
  }, [negativePrompt, seedInput, stepsInput, cfgInput, renderSize]);
  const [stats, setStats] = useState<StudioStats>(() => loadStats());
  const [statsOpen, setStatsOpen] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [outfitOpen, setOutfitOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptOverride, setPromptOverride] = useState('');
  const [resetArmed, setResetArmed] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2800);
  }, []);

  const bumpAndCelebrate = (key: keyof StudioStats, n = 1) => {
    const prev = loadStats();
    const next = bumpStat(key, n);
    setStats(next);
    const fresh = achievements.filter(a => !a.test(prev) && a.test(next));
    if (fresh.length) {
      window.setTimeout(() => showToast(`🏆 Achievement unlocked: ${fresh[0].name}`), 350);
    }
  };

  const galleryJsonRef = useRef<HTMLInputElement>(null);
  const importImageRef = useRef<HTMLInputElement>(null);

  /* ------------------------------------------------------------ rooms */
  const [roomId, setRoomId] = useState(rooms[0].id);
  const room: Room = useMemo(() => rooms.find(r => r.id === roomId) ?? rooms[0], [roomId]);

  /* -------------------------------------------------------- persistence */
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

  /* ------------------------------------------------------------ actions */
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
      outfit:
        'red and black lace corset lingerie with matching satin panties, sheer black fishnet stockings, and ruby velvet choker',
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
    showToast('New persona preset created');
  };

  /* ------------------------------------------------- persona management */
  const duplicatePersona = (id: string) => {
    const src = girls.find(g => g.id === id) || girl;
    const copy: Girl = { ...src, id: `copy_${Date.now()}`, name: `${src.name} Copy`, memories: [...src.memories] };
    const next = [copy, ...girls];
    setGirls(next);
    saveGirls(next);
    selectGirl(copy.id);
    showToast(`${copy.name} created`);
  };

  const deletePersona = (id: string) => {
    if (deleteArmedId !== id) {
      setDeleteArmedId(id);
      showToast('Click delete again to confirm');
      window.setTimeout(() => setDeleteArmedId(cur => (cur === id ? null : cur)), 3500);
      return;
    }
    if (girls.length <= 1) {
      showToast('Cannot delete the last persona');
      setDeleteArmedId(null);
      return;
    }
    const next = girls.filter(g => g.id !== id);
    setGirls(next);
    saveGirls(next);
    setDeleteArmedId(null);
    if (id === selectedId) selectGirl(next[0].id);
    showToast('Persona removed');
  };

  const exportPersona = (id: string) => {
    const g = girls.find(x => x.id === id);
    if (!g) return;
    const blob = new Blob([JSON.stringify(g, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${g.id}_persona.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Persona exported as JSON');
  };

  const importPersonaFile = (file: File) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const g = JSON.parse(String(r.result)) as Girl;
        if (!g || !g.id || !g.name) throw new Error('bad');
        if (girls.some(x => x.id === g.id)) g.id = `import_${Date.now()}`;
        const next = [g, ...girls];
        setGirls(next);
        saveGirls(next);
        selectGirl(g.id);
        showToast(`${g.name} imported`);
      } catch {
        showToast('Invalid persona JSON');
      }
    };
    r.readAsText(file);
  };

  const exportChatLog = () => {
    const blob = new Blob(
      [JSON.stringify({ persona: girl.name, id: girl.id, exported: new Date().toISOString(), messages: chat }, null, 2)],
      { type: 'application/json' }
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${girl.id}_chat.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Chat log exported');
  };

  const handleRandomize = () => {
    const next = randomizeAvatar(draft);
    setDraft(next);
    updateGirl(draftToGirlPatch(next));
    showToast('Identity randomized — save to keep it');
  };

  const handleSaveAvatar = () => {
    updateGirl(draftToGirlPatch(draft));
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2200);
    showToast(`${draft.name} saved to presets`);
  };

  const handleCancel = () => {
    setView('builder');
    setDraft(defaultDraft(girl));
    setPromptOverride('');
    setPromptOpen(false);
    setOutfitOpen(false);
    setStyleFilter(null);
    setNegativePrompt('');
    setSeedInput('');
    showToast('Changes discarded');
  };

  const copyAvatarId = () => {
    navigator.clipboard?.writeText(girl.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  };

  const compiledPrompt = promptOverride.trim() ? promptOverride.trim() : buildDraftPrompt(draft, adult);

  const buildFullPrompt = (base: string) => {
    const neg = negativePrompt.trim();
    return neg ? `${base} Avoid: ${neg}.` : base;
  };

  const genRequest = (prompt: string, seed?: number) => ({
    prompt: buildFullPrompt(prompt),
    mode: 'image' as const,
    width: renderSize,
    height: renderSize,
    steps: stepsInput || undefined,
    cfg: cfgInput || undefined,
    seed: seed || (seedInput ? Number(seedInput) : undefined),
    negative: negativePrompt.trim() || undefined
  });

  const handleGenerate = async () => {
    if (provider === 'selfhosted' && !getServerBase()) {
      showToast('Configure your self-hosted server in ⚙ Settings → Self-Hosted first');
      setResult(
        'SELF-HOSTED engine selected but no server URL is configured. Open ⚙ Settings and enter your A1111 (port 7860) or ComfyUI (port 8188) address.'
      );
      return;
    }
    setBusy(true);
    setResult('Synthesizing high-detail avatar render…');
    try {
      const r = await generateWithFallback(genRequest(compiledPrompt), provider);
      if (r.assetUrl) {
        updateGirl({ previewUrl: r.assetUrl });
        addGalleryItem({
          avatarId: girl.id,
          mode: 'image',
          prompt: buildFullPrompt(compiledPrompt),
          assetUrl: r.assetUrl,
          provider: r.provider
        });
        setGallery(loadGallery());
        bumpAndCelebrate('generations');
        showToast(`Render complete · ${r.provider.toUpperCase()} engine · ${renderSize}px`);
      } else {
        showToast(r.warning || 'No media returned by provider');
      }
      setResult(r.text ?? r.warning ?? `Generation ready via ${r.provider}`);
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'Generation failed');
      showToast('Generation failed');
    } finally {
      setBusy(false);
    }
  };

  /* ------- BATCH VARIATIONS (x4) ------- */
  const variationPrompt = (i: number) => {
    const extras = [
      '',
      ' Variation: alternate camera angle, three-quarter turn.',
      ' Variation: direct gaze toward camera, subtle confident smile.',
      ' Variation: looking away thoughtfully, softer dreamy lighting.'
    ];
    return compiledPrompt + extras[i % 4];
  };

  const handleBatchRender = async () => {
    setBusy(true);
    setVariationsOpen(true);
    setVariations([
      { provider: '…', prompt: '' },
      { provider: '…', prompt: '' },
      { provider: '…', prompt: '' },
      { provider: '…', prompt: '' }
    ]);
    try {
      const results = await Promise.all(
        [0, 1, 2, 3].map(async i => {
          const r = await generateWithFallback(
            genRequest(variationPrompt(i), (seedInput ? Number(seedInput) : Date.now() % 100000) + i * 7),
            provider
          );
          return { url: r.assetUrl, provider: r.provider, prompt: buildFullPrompt(variationPrompt(i)) };
        })
      );
      setVariations(results);
      bumpAndCelebrate('generations', results.filter(r => r.url).length);
      showToast('4 variations rendered — pick your favorite');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Batch failed');
    } finally {
      setBusy(false);
    }
  };

  const rerollVariation = async (i: number) => {
    try {
      const r = await generateWithFallback(
        genRequest(variationPrompt(i), (Date.now() % 100000) + i * 13),
        provider
      );
      setVariations(vs =>
        vs.map((v, j) => (j === i ? { url: r.assetUrl, provider: r.provider, prompt: buildFullPrompt(variationPrompt(i)) } : v))
      );
      if (r.assetUrl) bumpAndCelebrate('generations');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Re-roll failed');
    }
  };

  const useVariation = (v: { url?: string; provider: string; prompt: string }) => {
    if (!v.url) return;
    updateGirl({ previewUrl: v.url });
    addGalleryItem({ avatarId: girl.id, mode: 'image', prompt: v.prompt, assetUrl: v.url, provider: v.provider });
    setGallery(loadGallery());
    setVariationsOpen(false);
    showToast('Variation applied to viewport & saved to gallery');
  };

  /* ------- STYLE PRESETS ------- */
  const applyStyle = (st: StylePreset) => {
    setStyleFilter(st.filter);
    setLightingMode(st.lighting);
    setDraft(d => applyStylePreset(d, st));
    showToast(`${st.name} style applied`);
  };

  /* ------- CLIPBOARD & CONTACT SHEET ------- */
  const copyPreviewToClipboard = async () => {
    try {
      const blob = await (await fetch(currentPreviewUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })]);
      showToast('Image copied to clipboard');
    } catch {
      showToast('Clipboard blocked — downloading instead');
      handleSavePng();
    }
  };

  const exportContactSheet = async () => {
    const items = gallery.filter(g => g.assetUrl).slice(0, 8);
    if (!items.length) {
      showToast('No renders available for a contact sheet');
      return;
    }
    try {
      const cols = Math.min(4, items.length);
      const rows = Math.ceil(items.length / cols);
      const cell = 512;
      const pad = 24;
      const canvas = document.createElement('canvas');
      canvas.width = cols * cell + (cols + 1) * pad;
      canvas.height = rows * cell + (rows + 1) * pad + 96;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no ctx');
      ctx.fillStyle = '#0a0a12';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fff';
      ctx.font = '700 34px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GROK GIRLS · CONTACT SHEET', canvas.width / 2, 58);
      const imgs = await Promise.all(
        items.map(
          item =>
            new Promise<HTMLImageElement | null>(res => {
              const im = new Image();
              im.onload = () => res(im);
              im.onerror = () => res(null);
              im.src = item.assetUrl!;
            })
        )
      );
      imgs.forEach((im, idx) => {
        if (!im) return;
        const x = pad + (idx % cols) * (cell + pad);
        const y = 84 + Math.floor(idx / cols) * (cell + pad);
        const sc = Math.min(cell / im.width, cell / im.height);
        const dw = im.width * sc;
        const dh = im.height * sc;
        ctx.fillStyle = '#101018';
        ctx.fillRect(x, y, cell, cell);
        ctx.drawImage(im, x + (cell - dw) / 2, y + (cell - dh) / 2, dw, dh);
        ctx.strokeStyle = 'rgba(144,78,221,0.55)';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, cell, cell);
      });
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'));
      if (!blob) throw new Error('no blob');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `grok-girls-contact-sheet-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
      showToast('Contact sheet downloaded');
    } catch {
      showToast('Contact sheet failed — some images are CORS-restricted');
    }
  };

  const lightboxPrev = () =>
    setLightboxIndex(i => (i === null ? null : (i - 1 + filteredGallery.length) % filteredGallery.length));
  const lightboxNext = () =>
    setLightboxIndex(i => (i === null ? null : (i + 1) % filteredGallery.length));

  const handleSavePng = async () => {
    try {
      await downloadMedia(currentPreviewUrl, `${girl.id}_avatar.png`);
      showToast('PNG downloaded');
    } catch {
      showToast('Download failed');
    }
  };

  /* ------------------------------------------------------------ chat */
  const sendChat = async (override?: string) => {
    const text = (override ?? chatInput).trim();
    if (!text || busy) return;
    const now = Date.now();
    const user: ChatMessage = { id: String(now), role: 'user', text, createdAt: now };
    const next = [...chat, user];
    setChat(next);
    saveChat(girl.id, next);
    setChatInput('');
    setBusy(true);
    try {
      const answer = await reply(girl, room, next, text, provider, adult);
      const out: ChatMessage[] = [
        ...next,
        { id: String(now + 1), role: 'assistant', text: answer, createdAt: now + 1 }
      ];
      setChat(out);
      saveChat(girl.id, out);
      addMemory(girls, girl.id, 'Conversation', text, room.id);
      bumpAndCelebrate('chats');
      const nextAvatar = interactionState(avatarState);
      setAvatarState(nextAvatar);
      saveAvatarState(girl.id, nextAvatar);
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'Chat error');
    } finally {
      setBusy(false);
    }
  };

  /* ------------------------------------------------------------ story */
  const renderStoryScene = async (interactionId: string) => {
    setBusy(true);
    setResult('Rendering story scene…');
    const prompt = buildGenerationPrompt(
      girl,
      room,
      room.interactions.find(x => x.id === interactionId)?.prompt ?? '',
      'image',
      true,
      interactionId,
      avatarState,
      story,
      adult
    );
    try {
      const r = await generateWithFallback({ prompt, mode: 'image', width: 1024, height: 1024 }, provider);
      if (r.assetUrl) {
        updateGirl({ previewUrl: r.assetUrl });
        addGalleryItem({ avatarId: girl.id, mode: 'image', prompt, assetUrl: r.assetUrl, provider: r.provider });
        setGallery(loadGallery());
        showToast(`Story scene rendered · ${r.provider.toUpperCase()}`);
      } else {
        showToast(r.warning || 'No media returned');
      }
      setResult(r.text ?? r.warning ?? 'Scene ready');
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'Scene render failed');
    } finally {
      setBusy(false);
    }
  };

  const advanceChapter = () => {
    const next = advanceStory(story, story.relationshipLevel + 1);
    setStory(next);
    bumpAndCelebrate('stories');
    const targetRoom = storyChapters.find(c => c.chapter === next.chapter)?.roomId;
    if (targetRoom) setRoomId(targetRoom);
    showToast(`Chapter ${next.chapter}: ${next.title}`);
  };

  const jumpToChapter = (chapter: number) => {
    const c = storyChapters.find(x => x.chapter === chapter);
    if (!c) return;
    if (c.minRelationship > story.relationshipLevel) {
      showToast('Chapter locked — raise relationship level first');
      return;
    }
    setStory({
      ...initialStory(c.minRelationship),
      relationshipLevel: Math.max(story.relationshipLevel, c.minRelationship)
    });
    setRoomId(c.roomId);
    showToast(`Jumped to Chapter ${c.chapter}: ${c.title}`);
  };

  /* ----------------------------------------------------------- gallery */
  const useAsViewport = (item: GalleryItem) => {
    if (!item.assetUrl) return;
    updateGirl({ previewUrl: item.assetUrl });
    showToast('Gallery render set as viewport preview');
  };

  const deleteGalleryItem = (id: string) => {
    removeGalleryItem(id);
    setGallery(loadGallery());
    showToast('Item removed');
  };

  const onImportGalleryFile = async (file: File) => {
    try {
      await importGallery(file);
      setGallery(loadGallery());
      showToast('Gallery imported');
    } catch {
      showToast('Import failed — file must be a gallery JSON array');
    }
  };

  /* ------------------------------------------------------------ import */
  const onImportImage = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Please choose an image file');
      return;
    }
    const url = URL.createObjectURL(file);
    const id = `import_${Date.now()}`;
    const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 26) || 'Imported Persona';
    const newGirl: Girl = {
      ...girl,
      id,
      name: baseName,
      thumbnailUrl: url,
      previewUrl: url,
      bio: 'Imported reference persona. Tune identity traits in the inspector.',
      traits: ['imported'],
      affinity: 50,
      trust: 50,
      emotion: 'calm',
      memories: []
    };
    const next = [newGirl, ...girls];
    setGirls(next);
    saveGirls(next);
    selectGirl(id);
    bumpAndCelebrate('imports');
    showToast('Image imported as new preset');
  };

  const resetAllData = () => {
    if (!resetArmed) {
      setResetArmed(true);
      showToast('Click again to confirm full reset');
      window.setTimeout(() => setResetArmed(false), 4000);
      return;
    }
    localStorage.clear();
    location.reload();
  };

  /* ------------------------------------------------------- keyboard */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSettingsOpen(false);
        setPremiumOpen(false);
        setHelpOpen(false);
        setOutfitOpen(false);
        setPromptOpen(false);
        setStatsOpen(false);
        setVariationsOpen(false);
        setLightboxIndex(null);
        setView('builder');
        return;
      }
      if (lightboxIndex !== null) {
        if (e.key === 'ArrowLeft') lightboxPrev();
        if (e.key === 'ArrowRight') lightboxNext();
        return;
      }
      if (isSettingsOpen || premiumOpen || helpOpen || outfitOpen) return;
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(t.tagName)) return;
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === 'z' && !e.shiftKey) {
          e.preventDefault();
          undoDraft();
        } else if (k === 'z' && e.shiftKey) {
          e.preventDefault();
          redoDraft();
        } else if (k === 'y') {
          e.preventDefault();
          redoDraft();
        }
        return;
      }
      switch (e.key.toLowerCase()) {
        case 'f':
          setImmersive(v => !v);
          break;
        case 'r':
          setRotationAngle(a => (a + 45) % 360);
          break;
        case 'z':
          setZoomLevel(z => (z > 1.2 ? 1 : 1.4));
          break;
        case 'g':
          handleGenerate();
          break;
        case 's':
          handleSaveAvatar();
          break;
        case 'p':
          setPromptOpen(v => !v);
          break;
        case 'v':
          setView('video');
          break;
        case 'c':
          setView('chat');
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Paste an image from clipboard -> new preset
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of Array.from(items)) {
        if (it.type.startsWith('image/')) {
          const f = it.getAsFile();
          if (f) {
            e.preventDefault();
            onImportImage(f);
            return;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  /* ------------------------------------------------------------- data */
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

  const makeupIcons: Record<string, string> = {
    'dark smokey eyeshadow with winged eyeliner': '🖤',
    'glitter cut-crease glam eyes': '✨',
    'natural soft glam': '🌿',
    'cyberpunk graphic liner with neon accents': '⚡',
    'gothic heavy kohl liner': '💀',
    'bronzed editorial glow': '🌇'
  };
  const lipstickIcons: Record<string, string> = {
    'bold ruby red satin': '💋',
    'deep crimson velvet': '🍷',
    'dark plum gothic': '🖤',
    'blood red gloss': '❤️',
    'nude velvet matte': '🍑',
    'electric neon magenta': '🩷'
  };

  const browOptions = [
    { label: 'Arched', style: 'arched' },
    { label: 'Straight', style: 'straight' },
    { label: 'Soft', style: 'soft rounded' },
    { label: 'Bold', style: 'bold angled' },
    { label: 'Thin', style: 'thin feathered' },
    { label: 'Natural', style: 'natural full' }
  ];

  const addonCards = [
    {
      key: 'choker',
      icon: '💎',
      title: 'CHOKER',
      count: `${String(avatarOptions.chokerStyle.indexOf(draft.chokerStyle || '') + 1).padStart(2, '0')} / ${String(avatarOptions.chokerStyle.length).padStart(2, '0')}`,
      onClick: () =>
        setDraft(d => ({ ...d, chokerStyle: cycleOption(avatarOptions.chokerStyle, d.chokerStyle) }))
    },
    {
      key: 'corset',
      icon: '🩱',
      title: 'CORSET',
      count: `${String(avatarOptions.outfit.indexOf(draft.outfit) + 1).padStart(2, '0')} / ${String(avatarOptions.outfit.length).padStart(2, '0')}`,
      onClick: () => setDraft(d => ({ ...d, outfit: cycleOption(avatarOptions.outfit, d.outfit) }))
    },
    {
      key: 'fishnets',
      icon: '🕸️',
      title: 'FISHNETS',
      count: `${String(avatarOptions.hosieryStyle.indexOf(draft.hosieryStyle || '') + 1).padStart(2, '0')} / ${String(avatarOptions.hosieryStyle.length).padStart(2, '0')}`,
      onClick: () =>
        setDraft(d => ({ ...d, hosieryStyle: cycleOption(avatarOptions.hosieryStyle, d.hosieryStyle) }))
    },
    {
      key: 'piercings',
      icon: '👂',
      title: 'PIERCINGS',
      count: `${String(draft.piercingsCount || 0).padStart(2, '0')} / 08`,
      onClick: () =>
        setDraft(d => ({ ...d, piercingsCount: ((d.piercingsCount || 0) + 1) % 9 }))
    },
    {
      key: 'scars',
      icon: '🩹',
      title: 'SCARS',
      count: `${String(avatarOptions.scarStyle.indexOf(draft.scarStyle || '') + 1).padStart(2, '0')} / ${String(avatarOptions.scarStyle.length).padStart(2, '0')}`,
      onClick: () => setDraft(d => ({ ...d, scarStyle: cycleOption(avatarOptions.scarStyle, d.scarStyle) }))
    },
    {
      key: 'makeup',
      icon: '💄',
      title: 'MAKEUP',
      count: `${String(avatarOptions.makeupStyle.indexOf(draft.makeupStyle || '') + 1).padStart(2, '0')} / ${String(avatarOptions.makeupStyle.length).padStart(2, '0')}`,
      onClick: () =>
        setDraft(d => ({ ...d, makeupStyle: cycleOption(avatarOptions.makeupStyle, d.makeupStyle) }))
    },
    {
      key: 'facepaint',
      icon: '🎨',
      title: 'FACE PAINT',
      count: `${String(avatarOptions.facePaintStyle.indexOf(draft.facePaintStyle || '') + 1).padStart(2, '0')} / ${String(avatarOptions.facePaintStyle.length).padStart(2, '0')}`,
      onClick: () =>
        setDraft(d => ({ ...d, facePaintStyle: cycleOption(avatarOptions.facePaintStyle, d.facePaintStyle) }))
    },
    {
      key: 'cyber',
      icon: '⚡',
      title: 'CYBERWARE',
      count: `${String(avatarOptions.augmentStyle.indexOf(draft.augmentStyle || '') + 1).padStart(2, '0')} / ${String(avatarOptions.augmentStyle.length).padStart(2, '0')}`,
      onClick: () =>
        setDraft(d => ({ ...d, augmentStyle: cycleOption(avatarOptions.augmentStyle, d.augmentStyle) }))
    }
  ];

  const currentPreviewUrl =
    girl.previewUrl ||
    (girl.id === 'ruby_noir'
      ? '/assets/ruby-noir.jpg'
      : girl.id === 'matrix_07'
      ? '/assets/matrix-07-center.jpg'
      : '/assets/ruby-noir.jpg');

  const viewportFilter =
    styleFilter ??
    (lightingMode === 'noir'
      ? 'contrast(1.15) brightness(1.02) drop-shadow(0 0 35px rgba(230, 32, 64, 0.35))'
      : lightingMode === 'wireframe'
      ? 'invert(1) hue-rotate(180deg)'
      : 'drop-shadow(0 20px 40px rgba(0,0,0,0.85))');

  const filteredGallery = galleryFilter === 'all' ? gallery : gallery.filter(g => g.provider === galleryFilter);
  const lightboxItem = lightboxIndex !== null ? filteredGallery[lightboxIndex] || null : null;

  const avatarIdTag =
    girl.id === 'ruby_noir'
      ? 'RUBY_NOIR_9X4C'
      : girl.id === 'matrix_07'
      ? 'MATRIX_07_8X9A'
      : `${girl.name.toUpperCase().replace(/\s+/g, '_').slice(0, 18)}_ID`;

  /* -------------------------------------------------------------- view */
  return (
    <div className={`app-container ${immersive ? 'immersive' : ''}`}>
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
            className={`rail-btn ${openSections.face && view === 'builder' ? 'active' : ''}`}
            onClick={() => {
              setView('builder');
              setOpenSections(p => ({ ...p, face: true }));
            }}
            title="Face & Makeup"
          >
            <span className="rail-icon">🎭</span>
            <span>Face</span>
          </button>

          <button
            className={`rail-btn ${openSections.eyes && view === 'builder' ? 'active' : ''}`}
            onClick={() => {
              setView('builder');
              setOpenSections(p => ({ ...p, eyes: true }));
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
            className={`rail-btn ${openSections.augments && view === 'builder' ? 'active' : ''}`}
            onClick={() => {
              setView('builder');
              setOpenSections(p => ({ ...p, augments: true }));
            }}
            title="Augments"
          >
            <span className="rail-icon">⚡</span>
            <span>Augments</span>
          </button>

          <button
            className={`rail-btn ${openSections.tattoos && view === 'builder' ? 'active' : ''}`}
            onClick={() => {
              setView('builder');
              setOpenSections(p => ({ ...p, tattoos: true }));
            }}
            title="Tattoos & Lace"
          >
            <span className="rail-icon">🖤</span>
            <span>Tattoos</span>
          </button>

          <button
            className={`rail-btn ${view === 'video' ? 'active' : ''}`}
            onClick={() => setView('video')}
            title="Video & Animation Studio"
          >
            <span className="rail-icon">🎬</span>
            <span>Animations</span>
          </button>

          <button
            className={`rail-btn ${premiumOpen ? 'active' : ''}`}
            onClick={() => setPremiumOpen(true)}
            title="Premium & Upgrades"
          >
            <span className="rail-icon">⭐</span>
            <span>Premium</span>
          </button>

          <button
            className={`rail-btn ${helpOpen ? 'active' : ''}`}
            onClick={() => setHelpOpen(true)}
            title="Help & Shortcuts"
          >
            <span className="rail-icon">❓</span>
            <span>Help</span>
          </button>
        </div>

        <div className="rail-footer">
          <button className="rail-btn" onClick={handleRandomize} title="Randomize Persona Traits">
            <span className="rail-icon">🎲</span>
          </button>

          <button
            className={`rail-btn ${statsOpen ? 'active' : ''}`}
            onClick={() => setStatsOpen(true)}
            title="Stats & Achievements"
          >
            <span className="rail-icon">📊</span>
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
          <button style={{ color: '#777' }} onClick={() => setView('presets')} title="Browse all presets">
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
                    : g.id === 'kira_hd'
                    ? 'HD Model · Studio Render'
                    : g.id === 'nova_hd'
                    ? 'HD Model · Low-Key Noir'
                    : g.id === 'aria_hd'
                    ? 'HD Model · Warm Editorial'
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
              className={`mode-pill ${view === 'presets' ? 'active' : ''}`}
              onClick={() => setView('presets')}
            >
              PRESETS
            </button>
            <button
              className={`mode-pill ${view === 'import' ? 'active' : ''}`}
              onClick={() => setView('import')}
            >
              IMPORT
            </button>
            <button
              className={`mode-pill ${view === 'chat' ? 'active' : ''}`}
              onClick={() => setView('chat')}
            >
              CHAT
            </button>
            <button
              className={`mode-pill ${view === 'story' ? 'active' : ''}`}
              onClick={() => setView('story')}
            >
              STORY
            </button>
            <button
              className={`mode-pill ${view === 'video' ? 'active' : ''}`}
              onClick={() => setView('video')}
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
            <button className="icon-tool-btn" disabled={!canUndo} onClick={undoDraft} title="Undo (Ctrl+Z)">
              ↶
            </button>
            <button className="icon-tool-btn" disabled={!canRedo} onClick={redoDraft} title="Redo (Ctrl+Y)">
              ↷
            </button>
            <button
              className="icon-tool-btn"
              onClick={() => setPromptOpen(v => !v)}
              title="Scene Prompt Editor (P)"
            >
              ✎
            </button>
            <button
              className="icon-tool-btn"
              onClick={() => setImmersive(v => !v)}
              title="Immersive Fullscreen (F)"
            >
              ⛶
            </button>
            <button className="icon-tool-btn" onClick={resetCamera} title="Reset View">
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
            <button className="icon-tool-btn" onClick={() => setIsSettingsOpen(true)} title="Provider Settings">
              ⋮
            </button>
          </div>
        </header>

        {/* Viewport Canvas Stage */}
        <div
          className={`viewport-stage ${panning ? 'grabbing' : ''}`}
          onPointerDown={onStagePointerDown}
          onPointerMove={onStagePointerMove}
          onPointerUp={onStagePointerEnd}
          onPointerLeave={onStagePointerEnd}
          onDragOver={e => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={e => {
            if (e.currentTarget === e.target) setDragging(false);
          }}
          onDrop={e => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onImportImage(f);
          }}
        >
          {dragging && (
            <div className="drop-overlay">
              <div className="drop-overlay-inner">🖼️ DROP IMAGE TO IMPORT AS PRESET</div>
            </div>
          )}
          <div className="character-render-wrap">
            <img
              src={currentPreviewUrl}
              alt={girl.name}
              draggable={false}
              className="character-image"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel}) rotate(${rotationAngle}deg)`,
                filter: viewportFilter
              }}
            />

            <div className="character-tag">
              {girl.id === 'ruby_noir'
                ? 'RUBY_NOIR_01'
                : girl.id === 'matrix_07'
                ? 'MATRIX_07'
                : girl.name.toUpperCase().replace(/\s+/g, '_')}
            </div>

            {/* Camera status chip */}
            <div className="camera-status-chip">
              {Math.round(zoomLevel * 100)}% · {rotationAngle}° · {lightingMode.toUpperCase()}
              {panning ? ' · DRAGGING' : ''}
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
            <button className="hud-btn" onClick={resetCamera} title="Center Pan">
              <span>✥</span> PAN
            </button>
            <button className="hud-btn" onClick={handleRandomize} title="Randomize Attributes">
              <span>🎲</span> RANDOM
            </button>
            <button className="hud-btn" onClick={handleSavePng} title="Download current render as PNG">
              <span>⬇</span> PNG
            </button>
            <button className="hud-btn" onClick={copyPreviewToClipboard} title="Copy image to clipboard">
              <span>⎘</span> COPY
            </button>
          </div>

          {/* Viewport Bottom Lighting / Camera Bar */}
          <div className="viewport-lighting-bar">
            <button
              className={`lighting-btn ${lightingMode === 'studio' ? 'active' : ''}`}
              onClick={() => {
                setLightingMode('studio');
                setStyleFilter(null);
              }}
              title="Studio Softbox Keylight"
            >
              ☀️
            </button>
            <button
              className={`lighting-btn ${lightingMode === 'noir' ? 'active' : ''}`}
              onClick={() => {
                setLightingMode('noir');
                setStyleFilter(null);
              }}
              title="Gothic Noir Armchair Shadows (Picture 1 Mood)"
            >
              💀
            </button>
            <button
              className={`lighting-btn ${lightingMode === 'full' ? 'active' : ''}`}
              onClick={() => {
                setLightingMode('full');
                setStyleFilter(null);
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
                setStyleFilter(null);
                setZoomLevel(1.35);
              }}
              title="Bust & Face Portrait"
            >
              👤
            </button>
            <button
              className={`lighting-btn ${lightingMode === 'wireframe' ? 'active' : ''}`}
              onClick={() => {
                setStyleFilter(null);
                setLightingMode(m => (m === 'wireframe' ? 'noir' : 'wireframe'));
              }}
              title="3D Depth Wireframe"
            >
              🧊
            </button>
          </div>

          {/* Scene Prompt Editor Panel */}
          {promptOpen && (
            <div className="prompt-editor-panel">
              <div className="prompt-editor-head">
                <span>SCENE PROMPT</span>
                <div>
                  <button
                    className="prompt-mini-btn"
                    onClick={() => {
                      navigator.clipboard?.writeText(compiledPrompt);
                      showToast('Prompt copied to clipboard');
                    }}
                  >
                    COPY
                  </button>
                  <button
                    className="prompt-mini-btn"
                    onClick={() => {
                      setPromptOverride(buildDraftPrompt(draft, adult));
                      showToast('Prompt rebuilt from current identity');
                    }}
                  >
                    REBUILD
                  </button>
                  <button className="prompt-mini-btn" onClick={() => setPromptOpen(false)}>
                    ✕
                  </button>
                </div>
              </div>
              <textarea
                className="prompt-textarea"
                value={promptOverride || compiledPrompt}
                onChange={e => setPromptOverride(e.target.value)}
                spellCheck={false}
              />
              <div className="advanced-grid">
                <label>
                  NEGATIVE PROMPT
                  <input
                    type="text"
                    value={negativePrompt}
                    onChange={e => setNegativePrompt(e.target.value)}
                    placeholder="blurry, low quality, extra fingers…"
                  />
                </label>
                <label>
                  SEED
                  <input
                    type="number"
                    value={seedInput}
                    onChange={e => setSeedInput(e.target.value)}
                    placeholder="random"
                  />
                </label>
                <label>
                  STEPS
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={stepsInput}
                    onChange={e => setStepsInput(Number(e.target.value))}
                  />
                </label>
                <label>
                  CFG
                  <input
                    type="number"
                    step={0.5}
                    min={1}
                    max={20}
                    value={cfgInput}
                    onChange={e => setCfgInput(Number(e.target.value))}
                  />
                </label>
                <label>
                  RESOLUTION
                  <select value={renderSize} onChange={e => setRenderSize(Number(e.target.value))}>
                    <option value={1024}>1024 · FAST</option>
                    <option value={1536}>1536 · HD</option>
                    <option value={2048}>2048 · ULTRA</option>
                  </select>
                </label>
              </div>
              <div className="prompt-editor-foot">
                The prompt compiles live from your builder choices. Negative/seed/steps/CFG are sent to
                cloud providers; the local engine uses them for seed & resolution.
              </div>
            </div>
          )}
        </div>

        {immersive && (
          <button className="immersive-exit" onClick={() => setImmersive(false)}>
            ⛶ EXIT FULLSCREEN (F)
          </button>
        )}

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
                className={`dock-tab ${dockTab === 'makeup' ? 'active' : ''}`}
                onClick={() => setDockTab('makeup')}
              >
                MAKEUP
              </button>
              <button
                className={`dock-tab ${dockTab === 'eyebrows' ? 'active' : ''}`}
                onClick={() => setDockTab('eyebrows')}
              >
                EYEBROWS
              </button>
              <button
                className={`dock-tab ${dockTab === 'scene' ? 'active' : ''}`}
                onClick={() => setDockTab('scene')}
              >
                SCENE STYLE
              </button>
            </div>

            <div className="dock-hair-content">
              {dockTab === 'style' && (
                <div className="hair-styles-grid">
                  {hairStylePresets.map(h => (
                    <button
                      key={h.style}
                      className={`hair-style-card ${draft.hairStyle === h.style ? 'active' : ''}`}
                      onClick={() => setDraft(d => ({ ...d, hairStyle: h.style }))}
                      title={h.label}
                    >
                      <span>{h.icon}</span>
                      <em>{h.label.split(' ')[0]}</em>
                    </button>
                  ))}
                </div>
              )}

              {dockTab === 'color' && (
                <div className="dock-color-content">
                  <ColorWheel
                    color={draft.colorAccent || (draft.hairColor.includes('red') ? '#E62040' : '#904EDD')}
                    onChange={hex => {
                      setDraft(d => ({
                        ...d,
                        colorAccent: hex,
                        hairColor:
                          hex.toLowerCase() === '#e62040'
                            ? 'vibrant ruby red'
                            : hex.toLowerCase() === '#904edd'
                            ? 'electric purple'
                            : hex.toLowerCase() === '#00f2fe'
                            ? 'neon cyan'
                            : hex.toLowerCase() === '#1f2430'
                            ? 'jet black'
                            : 'custom dyed'
                      }));
                    }}
                    accentColors={['#E62040', '#904EDD', '#00F2FE', '#1F2430', '#F5F5FA']}
                  />
                  <div className="hair-color-chips">
                    {avatarOptions.hairColor.map(hc => (
                      <button
                        key={hc}
                        className={`hair-color-chip ${draft.hairColor === hc ? 'active' : ''}`}
                        onClick={() => setDraft(d => ({ ...d, hairColor: hc }))}
                      >
                        {hc}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {dockTab === 'makeup' && (
                <div className="makeup-tab">
                  <div className="makeup-grid">
                    {avatarOptions.makeupStyle.map(m => (
                      <button
                        key={m}
                        className={`makeup-card ${draft.makeupStyle === m ? 'active' : ''}`}
                        onClick={() => setDraft(d => ({ ...d, makeupStyle: m }))}
                      >
                        <span>{makeupIcons[m] || '💄'}</span>
                        <em>{m.split(' ').slice(0, 2).join(' ')}</em>
                      </button>
                    ))}
                  </div>
                  <div className="lipstick-row">
                    <span className="dock-section-title">LIPSTICK</span>
                    <div className="lipstick-chips">
                      {avatarOptions.lipstickShade.map(ls => (
                        <button
                          key={ls}
                          className={`lipstick-chip ${draft.lipstickShade === ls ? 'active' : ''}`}
                          onClick={() => setDraft(d => ({ ...d, lipstickShade: ls }))}
                          title={ls}
                        >
                          {lipstickIcons[ls] || '💄'}
                          <em>{ls.split(' ')[0]}</em>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {dockTab === 'eyebrows' && (
                <div className="eyebrow-content">
                  <div className="brow-grid">
                    {browOptions.map(b => (
                      <button
                        key={b.style}
                        className={`brow-card ${draft.browShape === b.style ? 'active' : ''}`}
                        onClick={() => setDraft(d => ({ ...d, browShape: b.style }))}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                  <label className="brow-thickness-row">
                    <span>THICKNESS</span>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={draft.browThickness || 3}
                      onChange={e => setDraft(d => ({ ...d, browThickness: Number(e.target.value) }))}
                    />
                    <b>{draft.browThickness || 3} / 5</b>
                  </label>
                </div>
              )}

              {dockTab === 'scene' && (
                <div className="scene-style-panel">
                  <div className="scene-style-grid">
                    {stylePresets.map(st => (
                      <button
                        key={st.id}
                        className={`scene-style-card ${draft.styleTag === st.prompt ? 'active' : ''}`}
                        onClick={() => applyStyle(st)}
                        title={st.description}
                      >
                        <span>{st.icon}</span>
                        <em>{st.name}</em>
                      </button>
                    ))}
                  </div>
                  <p className="scene-style-note">
                    One-click scene direction: lighting filter, backdrop, accent color and prompt style.
                    {styleFilter && (
                      <button
                        className="prompt-mini-btn"
                        onClick={() => {
                          setStyleFilter(null);
                          showToast('Style reset to manual lighting');
                        }}
                      >
                        RESET
                      </button>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Middle: Details & Add-Ons */}
          <div className="dock-addons-section">
            <div className="dock-section-title">DETAILS &amp; ADD-ONS</div>
            <div className="addons-grid">
              {addonCards.map(a => (
                <div key={a.key} className="addon-card active" onClick={a.onClick} title="Click to cycle options">
                  <div className="addon-icon">{a.icon}</div>
                  <div className="addon-title">{a.title}</div>
                  <div className="addon-count">{a.count}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Multi-Angle Preview */}
          <div className="dock-preview-section">
            <div className="preview-camera-icons">
              <span className="active" title="Front" onClick={resetCamera}>
                🧍
              </span>
              <span
                title="Torso"
                onClick={() => {
                  setZoomLevel(1.3);
                  setRotationAngle(0);
                }}
              >
                👤
              </span>
              <span
                title="Close-up"
                onClick={() => {
                  setZoomLevel(1.6);
                }}
              >
                🔍
              </span>
              <span
                title="Back"
                onClick={() => {
                  setRotationAngle(180);
                  setZoomLevel(1);
                }}
              >
                🪞
              </span>
            </div>

            <div className="preview-circles-row">
              <div
                className="preview-circle active"
                onClick={() => {
                  setZoomLevel(1.3);
                  setRotationAngle(0);
                }}
                title="Front Portrait"
              >
                <img
                  src={girl.id === 'ruby_noir' ? '/assets/ruby-noir-thumb.jpg' : '/assets/preset-1.jpg'}
                  alt="Front Angle"
                />
              </div>

              <div
                className="preview-circle"
                onClick={resetCamera}
                title="3/4 Reclining Armchair Angle (Picture 1)"
              >
                <img
                  src={girl.id === 'ruby_noir' ? '/assets/ruby-noir.jpg' : '/assets/matrix-07-center.jpg'}
                  alt="3/4 Angle"
                />
              </div>

              <div
                className="preview-circle"
                onClick={() => setRotationAngle(180)}
                title="Back Silhouette"
              >
                <img
                  src={girl.id === 'ruby_noir' ? '/assets/ruby-noir-thumb.jpg' : '/assets/preset-4.jpg'}
                  alt="Back Angle"
                />
              </div>
            </div>
          </div>
        </div>

        {/* PRESETS BROWSER OVERLAY */}
        {view === 'presets' && (
          <div className="companion-overlay-dock">
            <div className="companion-header">
              <div>
                <h3 style={{ margin: 0, color: '#fff', fontSize: 16 }}>Preset Identity Browser</h3>
                <span style={{ fontSize: 11, color: '#aaa' }}>
                  {girls.length} personas · load, duplicate, export or remove
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="prompt-mini-btn" onClick={() => personaImportRef.current?.click()}>
                  IMPORT PERSONA
                </button>
                <button className="prompt-mini-btn" onClick={() => exportPersona(selectedId)}>
                  EXPORT SELECTED
                </button>
                <button onClick={() => setView('builder')}>✕</button>
              </div>
            </div>
            <input
              ref={personaImportRef}
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) importPersonaFile(f);
                e.target.value = '';
              }}
            />
            <div className="preset-browser-grid">
              {girls.map(g => (
                <div key={g.id} className={`preset-browser-card ${g.id === selectedId ? 'selected' : ''}`}>
                  <img
                    src={
                      g.thumbnailUrl ||
                      (g.id === 'ruby_noir' ? '/assets/ruby-noir-thumb.jpg' : '/assets/ruby-noir-thumb.jpg')
                    }
                    alt={g.name}
                  />
                  <div className="preset-browser-info">
                    <b>{g.name}</b>
                    <span>
                      {g.hairColor} · {g.skinTone}
                    </span>
                    <span className="preset-browser-tags">{g.traits.join(' · ')}</span>
                  </div>
                  <button
                    className="preset-browser-load"
                    onClick={() => {
                      selectGirl(g.id);
                      setView('builder');
                      showToast(`${g.name} loaded into studio`);
                    }}
                  >
                    LOAD
                  </button>
                  <div className="preset-card-actions">
                    <button title="Duplicate persona" onClick={() => duplicatePersona(g.id)}>
                      ⧉
                    </button>
                    <button title="Export persona JSON" onClick={() => exportPersona(g.id)}>
                      ⬇
                    </button>
                    <button
                      className={deleteArmedId === g.id ? 'armed' : ''}
                      title="Delete persona"
                      onClick={() => deletePersona(g.id)}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
              <div className="preset-browser-card new" onClick={handleCreateNewPreset}>
                <div className="preset-browser-plus">+</div>
                <span>New Preset</span>
              </div>
            </div>
          </div>
        )}

        {/* IMPORT OVERLAY */}
        {view === 'import' && (
          <div className="companion-overlay-dock">
            <div className="companion-header">
              <div>
                <h3 style={{ margin: 0, color: '#fff', fontSize: 16 }}>Import &amp; Data</h3>
                <span style={{ fontSize: 11, color: '#aaa' }}>
                  Bring in gallery archives, reference images, or reset the studio
                </span>
              </div>
              <button onClick={() => setView('builder')}>✕</button>
            </div>
            <div className="import-panel">
              <div className="import-card">
                <div className="import-icon">🖼️</div>
                <h4>Import Image as Preset</h4>
                <p>Load a photo or reference render — it becomes a selectable persona you can restyle.</p>
                <button className="btn-import-action" onClick={() => importImageRef.current?.click()}>
                  CHOOSE IMAGE
                </button>
                <input
                  ref={importImageRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) onImportImage(f);
                    e.target.value = '';
                  }}
                />
              </div>

              <div className="import-card">
                <div className="import-icon">🗂️</div>
                <h4>Import Gallery Archive</h4>
                <p>Restore a previously exported gallery JSON file ({gallery.length} items currently).</p>
                <button className="btn-import-action" onClick={() => galleryJsonRef.current?.click()}>
                  CHOOSE JSON
                </button>
                <input
                  ref={galleryJsonRef}
                  type="file"
                  accept="application/json"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) onImportGalleryFile(f);
                    e.target.value = '';
                  }}
                />
              </div>

              <div className="import-card danger">
                <div className="import-icon">🧨</div>
                <h4>Reset Studio Data</h4>
                <p>Wipes personas, gallery, chats, draft and settings from this browser.</p>
                <button
                  className={`btn-import-action ${resetArmed ? 'armed' : ''}`}
                  onClick={resetAllData}
                >
                  {resetArmed ? 'CLICK AGAIN TO CONFIRM' : 'RESET ALL DATA'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* COMPANION CHAT OVERLAY VIEW */}
        {view === 'chat' && (
          <div className="companion-overlay-dock">
            <div className="companion-header">
              <div>
                <h3 style={{ margin: 0, color: '#fff', fontSize: 16 }}>Dialogue with {girl.name}</h3>
                <span style={{ fontSize: 11, color: '#aaa' }}>
                  {girl.room} · {girl.emotion} mood · {Math.round(avatarState.affection)}% affection
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  className="mini-provider-select"
                  value={provider}
                  onChange={e => setProvider(e.target.value as ProviderName)}
                  title="Chat AI engine"
                >
                  <option value="local">LOCAL</option>
                  <option value="openrouter">OPENROUTER</option>
                  <option value="gemini">GEMINI</option>
                  <option value="custom">CUSTOM</option>
                  <option value="selfhosted">SELF-HOSTED</option>
                </select>
                <button className="prompt-mini-btn" onClick={exportChatLog} title="Export chat log as JSON">
                  EXPORT LOG
                </button>
                <button style={{ color: '#aaa', fontSize: 16 }} onClick={() => setView('builder')}>
                  ✕ Close Chat
                </button>
              </div>
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

            <div className="chat-quick-chips">
              {['Hello', 'Tell me about yourself', 'Compliment my outfit', 'What would we do tonight?'].map(
                q => (
                  <button key={q} onClick={() => sendChat(q)} disabled={busy}>
                    {q}
                  </button>
                )
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
              <button className="btn-send-chat" disabled={busy} onClick={() => sendChat()}>
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
                  Objective: {story.objective} · Relationship Level {story.relationshipLevel} ·{' '}
                  {statePrompt(avatarState)}
                </span>
              </div>
              <button style={{ color: '#aaa', fontSize: 16 }} onClick={() => setView('builder')}>
                ✕
              </button>
            </div>

            <div className="story-body">
              <div className="story-scene-card">
                <p>{storyPrompt(story)}</p>
              </div>

              <div className="story-chapter-row">
                {storyChapters.map(c => {
                  const unlocked = c.minRelationship <= story.relationshipLevel;
                  return (
                    <div
                      key={c.chapter}
                      className={`chapter-card ${c.chapter === story.chapter ? 'current' : ''} ${unlocked ? 'unlocked' : 'locked'}`}
                      onClick={() => jumpToChapter(c.chapter)}
                    >
                      <b>Ch {c.chapter}</b>: {c.title}
                      {!unlocked && <span className="chapter-lock">🔒</span>}
                    </div>
                  );
                })}
              </div>

              <div className="story-action-row">
                <span className="story-action-label">SCENE ACTIONS</span>
                {room.interactions.map(intr => (
                  <button
                    key={intr.id}
                    className="btn-generate-media"
                    disabled={busy}
                    onClick={() => renderStoryScene(intr.id)}
                  >
                    🎬 {intr.label}
                  </button>
                ))}
                <button className="btn-generate-media ghost" onClick={advanceChapter}>
                  ⏭ Advance Chapter
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIDEO EXPORT OVERLAY VIEW */}
        {view === 'video' && (
          <div className="companion-overlay-dock" style={{ padding: 0 }}>
            <div
              style={{
                padding: '14px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                borderBottom: '1px solid #1e1e2d'
              }}
            >
              <h3 style={{ margin: 0, fontSize: 15 }}>Video Render Studio</h3>
              <button onClick={() => setView('builder')}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              <VideoExportPage
                girl={girl}
                room={room}
                latestAssetUrl={currentPreviewUrl}
                adult={adult}
                provider={provider}
                videoPrompt={buildDraftPrompt(draft, adult)}
                onRendered={() => bumpAndCelebrate('videos')}
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
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="prompt-mini-btn" onClick={exportContactSheet} title="Download a PNG grid of your renders">
                  CONTACT SHEET
                </button>
                <button className="prompt-mini-btn" onClick={() => exportGallery(gallery)}>
                  EXPORT JSON
                </button>
                <button className="prompt-mini-btn" onClick={() => galleryJsonRef.current?.click()}>
                  IMPORT
                </button>
                <input
                  ref={galleryJsonRef}
                  type="file"
                  accept="application/json"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) onImportGalleryFile(f);
                    e.target.value = '';
                  }}
                />
                <button onClick={() => setView('builder')}>✕</button>
              </div>
            </div>

            <div className="gallery-filter-chips">
              {(['all', 'local', 'openrouter', 'gemini', 'custom', 'selfhosted'] as const).map(pv => (
                <button
                  key={pv}
                  className={`gallery-filter-chip ${galleryFilter === pv ? 'active' : ''}`}
                  onClick={() => setGalleryFilter(pv)}
                >
                  {pv.toUpperCase()}
                </button>
              ))}
            </div>

            {gallery.length === 0 ? (
              <div className="gallery-empty">
                <div className="gallery-empty-icon">🖼️</div>
                <h4>No renders yet</h4>
                <p>
                  Hit <b>GENERATE RENDER</b> in the studio footer or render a story scene. Every result
                  lands here, ready to export.
                </p>
                <button className="btn-import-action" onClick={() => setView('builder')}>
                  GO TO STUDIO
                </button>
              </div>
            ) : (
              <div className="gallery-grid">
                {filteredGallery.length === 0 && gallery.length > 0 && (
                  <div className="gallery-empty" style={{ minHeight: 110 }}>
                    No renders from this engine yet — switch the filter or generate more.
                  </div>
                )}
                {filteredGallery.map((item, idx) => (
                  <div key={item.id} className="gallery-card" onClick={() => setLightboxIndex(idx)}>
                    {item.assetUrl ? (
                      <img src={item.assetUrl} alt="Generation" />
                    ) : (
                      <div className="gallery-card-placeholder">QUEUED</div>
                    )}
                    <div className="gallery-card-meta">
                      <span className="gallery-provider">{item.provider.toUpperCase()}</span>
                      <span className="gallery-mode">{item.mode.toUpperCase()}</span>
                    </div>
                    <div className="gallery-card-actions" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setGallery(toggleFavorite(item.id));
                          if (!item.favorite) bumpAndCelebrate('favorites');
                        }}
                        title="Favorite"
                      >
                        {item.favorite ? '★' : '☆'}
                      </button>
                      <button onClick={() => useAsViewport(item)} title="Set as viewport preview">
                        🖥
                      </button>
                      {item.assetUrl && (
                        <button
                          onClick={() => downloadMedia(item.assetUrl!, `${item.id}.png`)}
                          title="Download"
                        >
                          ⬇
                        </button>
                      )}
                      <button onClick={() => deleteGalleryItem(item.id)} title="Delete">
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                <div className="inspector-label">
                  <span>Persona Name</span>
                  <input
                    className="name-input"
                    value={draft.name}
                    maxLength={24}
                    onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                    placeholder="Name your persona…"
                  />
                </div>

                <div className="inspector-label">
                  <span>Gender</span>
                  <div className="gender-selector">
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

                <div className="inspector-label">
                  <div className="slider-stepper-row">
                    <span>Head Shape</span>
                    <span className="stepper-val">
                      &lt; {String(draft.headShapeIndex || 4).padStart(2, '0')} / 12 &gt;
                    </span>
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

          {/* Section: HAIR */}
          <div className="accordion-item">
            <button className="accordion-trigger" onClick={() => toggleSection('hair')}>
              <span>Hair</span>
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

          {/* Section: EYES */}
          <div className="accordion-item">
            <button className="accordion-trigger" onClick={() => toggleSection('eyes')}>
              <span>Eyes</span>
              <span className={`accordion-chevron ${openSections.eyes ? 'open' : ''}`}>▼</span>
            </button>

            {openSections.eyes && (
              <div className="accordion-body">
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
                  <span>Eye Shape</span>
                  <select
                    className="inspector-select"
                    value={draft.eyeShape}
                    onChange={e => setDraft(d => ({ ...d, eyeShape: e.target.value }))}
                  >
                    {avatarOptions.eyeShape.map(es => (
                      <option key={es} value={es}>
                        {es}
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

          {/* Section: FACE */}
          <div className="accordion-item">
            <button className="accordion-trigger" onClick={() => toggleSection('face')}>
              <span>Face</span>
              <span className={`accordion-chevron ${openSections.face ? 'open' : ''}`}>▼</span>
            </button>

            {openSections.face && (
              <div className="accordion-body">
                <label className="inspector-label">
                  <span>Face Shape</span>
                  <select
                    className="inspector-select"
                    value={draft.faceShape}
                    onChange={e => setDraft(d => ({ ...d, faceShape: e.target.value }))}
                  >
                    {avatarOptions.faceShape.map(fs => (
                      <option key={fs} value={fs}>
                        {fs}
                      </option>
                    ))}
                  </select>
                </label>

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
                  <span>Makeup Style</span>
                  <select
                    className="inspector-select"
                    value={draft.makeupStyle || avatarOptions.makeupStyle[0]}
                    onChange={e => setDraft(d => ({ ...d, makeupStyle: e.target.value }))}
                  >
                    {avatarOptions.makeupStyle.map(ms => (
                      <option key={ms} value={ms}>
                        {ms}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>

          {/* Section: BODY */}
          <div className="accordion-item">
            <button className="accordion-trigger" onClick={() => toggleSection('body')}>
              <span>Body</span>
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
                  <span>Pose &amp; Reclining Angle</span>
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

          {/* Section: CLOTHING & LINGERIE (Crucial for Picture 1!) */}
          <div className="accordion-item">
            <button className="accordion-trigger" onClick={() => toggleSection('clothing')}>
              <span>Clothing &amp; Lingerie</span>
              <span className={`accordion-chevron ${openSections.clothing ? 'open' : ''}`}>▼</span>
            </button>

            {openSections.clothing && (
              <div className="accordion-body">
                <label className="inspector-label">
                  <span>Corset &amp; Lingerie Style</span>
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
                  <span>Neckwear &amp; Choker</span>
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
                  <span>Hosiery &amp; Stockings</span>
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
                  <span>Scene Backdrop</span>
                  <select
                    className="inspector-select"
                    value={draft.chairSetting || avatarOptions.chairSetting[0]}
                    onChange={e => setDraft(d => ({ ...d, chairSetting: e.target.value }))}
                  >
                    {avatarOptions.chairSetting.map(cs => (
                      <option key={cs} value={cs}>
                        {cs.slice(0, 44)}…
                      </option>
                    ))}
                  </select>
                </label>

                <label className="inspector-label">
                  <span>Environment Room</span>
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

          {/* Section: TATTOOS */}
          <div className="accordion-item">
            <button className="accordion-trigger" onClick={() => toggleSection('tattoos')}>
              <span>Tattoos</span>
              <span className={`accordion-chevron ${openSections.tattoos ? 'open' : ''}`}>▼</span>
            </button>

            {openSections.tattoos && (
              <div className="accordion-body">
                <div className="option-chip-grid">
                  {avatarOptions.tattooStyle.map(t => (
                    <button
                      key={t}
                      className={`option-chip ${draft.tattooStyle === t ? 'active' : ''}`}
                      onClick={() => setDraft(d => ({ ...d, tattooStyle: t }))}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section: AUGMENTS */}
          <div className="accordion-item">
            <button className="accordion-trigger" onClick={() => toggleSection('augments')}>
              <span>Augments</span>
              <span className={`accordion-chevron ${openSections.augments ? 'open' : ''}`}>▼</span>
            </button>

            {openSections.augments && (
              <div className="accordion-body">
                <div className="option-chip-grid">
                  {avatarOptions.augmentStyle.map(a => (
                    <button
                      key={a}
                      className={`option-chip ${draft.augmentStyle === a ? 'active' : ''}`}
                      onClick={() => setDraft(d => ({ ...d, augmentStyle: a }))}
                    >
                      {a}
                    </button>
                  ))}
                </div>
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
            <b style={{ color: '#fff' }}>{avatarIdTag}</b>
            <button onClick={copyAvatarId} title="Copy Avatar ID">
              {copiedId ? '✓' : '⎘'}
            </button>
          </div>

          <button className="btn-load-outfit" onClick={() => setOutfitOpen(true)}>
            <span>👚</span> LOAD OUTFIT
          </button>

          <label className="footer-provider-wrap" title="Generation engine">
            <span>ENGINE</span>
            <select
              className="footer-provider-select"
              value={provider}
              onChange={e => setProvider(e.target.value as ProviderName)}
            >
              <option value="local">LOCAL</option>
              <option value="openrouter">OPENROUTER</option>
              <option value="gemini">GEMINI</option>
              <option value="custom">CUSTOM</option>
              <option value="selfhosted">SELF-HOSTED</option>
            </select>
          </label>
        </div>

        <div className="footer-right">
          {saveToast && (
            <span style={{ color: '#7ff0bd', fontSize: 12, fontWeight: 700 }}>✓ Avatar identity saved!</span>
          )}

          {busy && <span className="busy-indicator">RENDERING…</span>}

          <button className="btn-cancel" onClick={handleCancel}>
            CANCEL
          </button>

          <button
            className="btn-batch"
            disabled={busy}
            onClick={handleBatchRender}
            title="Generate 4 variations at once"
          >
            ⧉ x4
          </button>

          <button className="btn-generate-media" disabled={busy} onClick={handleGenerate}>
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

      {/* OUTFIT DRAWER */}
      {outfitOpen && (
        <div className="modal-backdrop" onClick={() => setOutfitOpen(false)}>
          <div className="modal-card outfit-drawer" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>👗 Outfit Wardrobe</h3>
              <button className="modal-close" onClick={() => setOutfitOpen(false)}>
                ✕
              </button>
            </div>
            <div className="outfit-list">
              {avatarOptions.outfit.map((o, i) => (
                <button
                  key={o}
                  className={`outfit-option ${draft.outfit === o ? 'active' : ''}`}
                  onClick={() => {
                    setDraft(d => ({ ...d, outfit: o }));
                    setOutfitOpen(false);
                    showToast('Outfit loaded');
                  }}
                >
                  <span className="outfit-index">{String(i + 1).padStart(2, '0')}</span>
                  <span>{o}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PREMIUM MODAL */}
      {premiumOpen && (
        <div className="modal-backdrop" onClick={() => setPremiumOpen(false)}>
          <div className="modal-card premium-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>⭐ Grok Girls Premium</h3>
              <button className="modal-close" onClick={() => setPremiumOpen(false)}>
                ✕
              </button>
            </div>
            <div className="premium-feature-list">
              {[
                ['🧠', 'Cloud neural rendering', 'OpenRouter / Gemini / Custom endpoints'],
                ['🎬', 'Video & animation studio', 'Cinematic camera paths and lighting passes'],
                ['💾', 'Unlimited gallery & exports', 'PNG, JSON archives, HD downloads'],
                ['💬', 'Deep companion memory', 'Persistent persona state across sessions'],
                ['👑', 'Adult 18+ mode', 'Mature boudoir scene direction (all adults)']
              ].map(([icon, title, sub]) => (
                <div key={title} className="premium-feature">
                  <span>{icon}</span>
                  <div>
                    <b>{title}</b>
                    <p>{sub}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="row" style={{ marginTop: 18, justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={() => setPremiumOpen(false)}>
                Not now
              </button>
              <button
                type="button"
                className="generate"
                onClick={() => {
                  const ok = redirectToPaymentLink();
                  showToast(ok ? 'Opening checkout…' : 'Payment link not configured yet');
                }}
              >
                UPGRADE NOW
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HELP MODAL */}
      {helpOpen && (
        <div className="modal-backdrop" onClick={() => setHelpOpen(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>❓ Studio Help</h3>
              <button className="modal-close" onClick={() => setHelpOpen(false)}>
                ✕
              </button>
            </div>
            <div className="help-list">
              <div>
                <b>Builder</b> — tweak every identity trait in the right panel; the scene prompt rebuilds
                live from your choices.
              </div>
              <div>
                <b>Generate Render</b> — compiles your avatar + pose + wardrobe into an image via the
                selected engine (footer). Local engine works offline.
              </div>
              <div>
                <b>Viewport</b> — drag to pan, ROTATE / ZOOM / PAN buttons, lighting bar for the noir
                armchair mood, PNG export.
              </div>
              <div>
                <b>Chat &amp; Story</b> — talk with your persona and advance chapters; scene actions
                render story images to the gallery.
              </div>
              <div>
                <b>Keys</b> — add OpenRouter/Gemini/Custom credentials in ⚙ Settings (stored in your
                browser only).
              </div>
              <div>
                <b>Shortcuts</b> — R rotate · Z zoom · P prompt editor · G generate · S save · V video
                studio · C chat · F fullscreen · Ctrl+Z / Ctrl+Y undo / redo · ←/→ navigate lightbox ·
                Esc closes any overlay.
              </div>
              <div>
                <b>Pro moves</b> — drag & drop (or Ctrl+V paste) any image onto the viewport to import
                it as a preset · click gallery items for the fullscreen lightbox · SCENE STYLE tab for
                one-click moods · ⧉ x4 renders four variations at once.
              </div>
            </div>
            <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
              <button type="button" className="generate" onClick={() => setHelpOpen(false)}>
                GOT IT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VARIATIONS OVERLAY */}
      {variationsOpen && (
        <div className="modal-backdrop" onClick={() => setVariationsOpen(false)}>
          <div className="modal-card variations-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>⧉ 4 Variations — {girl.name}</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="prompt-mini-btn" disabled={busy} onClick={handleBatchRender}>
                  ↻ RE-ROLL ALL
                </button>
                <button className="modal-close" onClick={() => setVariationsOpen(false)}>
                  ✕
                </button>
              </div>
            </div>
            {busy ? (
              <div className="variations-grid">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="variation-card loading">
                    <div className="variation-shimmer" />
                    <span>RENDERING…</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="variations-grid">
                {variations.map((v, i) => (
                  <div key={i} className="variation-card">
                    {v.url ? (
                      <img src={v.url} alt={`Variation ${i + 1}`} />
                    ) : (
                      <div className="variation-placeholder">FAILED</div>
                    )}
                    <span className="gallery-provider">#{i + 1} · {v.provider.toUpperCase()}</span>
                    <div className="variation-actions">
                      <button onClick={() => useVariation(v)} disabled={!v.url}>
                        USE THIS
                      </button>
                      <button onClick={() => rerollVariation(i)} disabled={busy}>
                        ↻
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p style={{ margin: '10px 0 0', fontSize: 11, color: '#8b8ba6' }}>
              USE THIS loads the render into the viewport and saves it to the gallery.
            </p>
          </div>
        </div>
      )}

      {/* LIGHTBOX OVERLAY */}
      {lightboxItem && (
        <div className="lightbox-backdrop" onClick={() => setLightboxIndex(null)}>
          <button className="lightbox-arrow left" onClick={e => { e.stopPropagation(); lightboxPrev(); }}>
            ‹
          </button>
          <div className="lightbox-frame" onClick={e => e.stopPropagation()}>
            <div className="lightbox-imgwrap">
              {lightboxItem.assetUrl ? (
                <img src={lightboxItem.assetUrl} alt="Render" />
              ) : (
                <div className="variation-placeholder">QUEUED</div>
              )}
            </div>
            <div className="lightbox-bar">
              <div className="lightbox-meta">
                <span className="gallery-provider">{lightboxItem.provider.toUpperCase()}</span>
                <span className="gallery-mode">
                  {lightboxItem.mode.toUpperCase()} · {(lightboxIndex ?? 0) + 1} / {filteredGallery.length}
                </span>
              </div>
              <div className="lightbox-actions">
                <button
                  onClick={() => {
                    setGallery(toggleFavorite(lightboxItem.id));
                    if (!lightboxItem.favorite) bumpAndCelebrate('favorites');
                  }}
                  title="Favorite"
                >
                  {lightboxItem.favorite ? '★' : '☆'}
                </button>
                <button onClick={() => useAsViewport(lightboxItem)} title="Set as viewport preview">
                  🖥
                </button>
                {lightboxItem.assetUrl && (
                  <button
                    onClick={() => downloadMedia(lightboxItem.assetUrl!, `${lightboxItem.id}.png`)}
                    title="Download"
                  >
                    ⬇
                  </button>
                )}
                <button
                  onClick={() => {
                    deleteGalleryItem(lightboxItem.id);
                    setLightboxIndex(null);
                  }}
                  title="Delete"
                >
                  🗑
                </button>
                <button className="modal-close" onClick={() => setLightboxIndex(null)}>
                  ✕
                </button>
              </div>
            </div>
            <div className="lightbox-prompt">{lightboxItem.prompt}</div>
          </div>
          <button className="lightbox-arrow right" onClick={e => { e.stopPropagation(); lightboxNext(); }}>
            ›
          </button>
        </div>
      )}

      {/* STATS & ACHIEVEMENTS MODAL */}
      {statsOpen && (
        <div className="modal-backdrop" onClick={() => setStatsOpen(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📊 Studio Stats & Achievements</h3>
              <button className="modal-close" onClick={() => setStatsOpen(false)}>
                ✕
              </button>
            </div>
            <div className="stats-grid">
              <div className="stat-cell">
                <b>{stats.generations}</b>
                <span>RENDERS</span>
              </div>
              <div className="stat-cell">
                <b>{stats.favorites}</b>
                <span>FAVORITES</span>
              </div>
              <div className="stat-cell">
                <b>{stats.chats}</b>
                <span>MESSAGES</span>
              </div>
              <div className="stat-cell">
                <b>{stats.stories}</b>
                <span>CHAPTERS</span>
              </div>
              <div className="stat-cell">
                <b>{stats.imports}</b>
                <span>IMPORTS</span>
              </div>
              <div className="stat-cell">
                <b>{stats.videos}</b>
                <span>CLIPS</span>
              </div>
            </div>
            <div className="dock-section-title" style={{ margin: '16px 0 10px' }}>
              ACHIEVEMENTS
            </div>
            <div className="achievement-grid">
              {achievements.map(a => {
                const unlocked = a.test(stats);
                return (
                  <div key={a.id} className={`achievement-card ${unlocked ? 'unlocked' : 'locked'}`}>
                    <span className="achievement-icon">{unlocked ? a.icon : '🔒'}</span>
                    <b>{a.name}</b>
                    <p>{a.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* TOAST */}
      {toast && <div className="toast">{toast}</div>}

      {/* STATUS LINE (debug/result) */}
      {result && view === 'builder' && (
        <div className="status-line" onClick={() => setResult('')} title="Click to dismiss">
          {result}
        </div>
      )}
    </div>
  );
}
