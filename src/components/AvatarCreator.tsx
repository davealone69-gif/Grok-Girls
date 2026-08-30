import React, { useState, useEffect } from 'react';
import { AvatarDraft, avatarOptions, randomizeAvatar, buildDraftPrompt } from '../services/avatarCreator';
import { AdultSelections, adultOptions, buildAdultPrompt, defaultAdultSelections } from '../services/adultOptions';

export interface AvatarCreatorProps {
  initial: AvatarDraft;
  mode?: 'image' | 'video';
  roomId?: string;
  onSave?: (draft: AvatarDraft) => void;
  onGenerate?: (draft: AvatarDraft) => void;
  adult?: boolean;
}

type AdultDraft = AvatarDraft & { adultSelections?: AdultSelections };

const label = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export default function AvatarCreator({ initial, onSave, onGenerate, adult = false }: AvatarCreatorProps) {
  const [draft, setDraft] = useState<AdultDraft>(initial as AdultDraft);
  const [savedNotice, setSavedNotice] = useState(false);
  const [adultSelections, setAdultSelections] = useState<AdultSelections>(
    () => (initial as AdultDraft).adultSelections || defaultAdultSelections()
  );

  useEffect(() => {
    const next = initial as AdultDraft;
    setDraft(next);
    setAdultSelections(next.adultSelections || defaultAdultSelections());
  }, [initial.id]);

  const update = <K extends keyof AvatarDraft>(key: K, value: AvatarDraft[K]) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  };

  const updateAdult = <K extends keyof AdultSelections>(key: K, value: AdultSelections[K]) => {
    setAdultSelections(prev => ({ ...prev, [key]: value }));
  };

  const combinedDraft = (): AdultDraft => ({ ...draft, adultSelections });

  const handleSave = () => {
    onSave?.(combinedDraft());
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2200);
  };

  const handleGenerate = () => {
    const next = combinedDraft();
    onSave?.(next);
    onGenerate?.(next);
  };

  const handleRandomize = () => {
    const randomized = randomizeAvatar(combinedDraft());
    setDraft(randomized as AdultDraft);
    onSave?.({ ...(randomized as AdultDraft), adultSelections });
  };

  const select = <K extends keyof AdultSelections>(key: K, options: readonly AdultSelections[K][]) => (
    <label key={String(key)}>
      {label(String(key).replace(/[A-Z]/g, m => ` ${m.toLowerCase()}`))}
      <select
        value={adultSelections[key] as string}
        onChange={e => updateAdult(key, e.target.value as AdultSelections[K])}
      >
        {options.map(option => <option key={String(option)} value={String(option)}>{label(String(option))}</option>)}
      </select>
    </label>
  );

  const promptPreview = `${buildDraftPrompt(draft, adult)}${adult ? ` ${buildAdultPrompt(adultSelections)}` : ''}`;

  return (
    <div className="avatar-creator-panel">
      <div className="hero">
        <div className="orb">{draft.name ? draft.name[0].toUpperCase() : 'A'}</div>
        <div>
          <span className="eyebrow">AVATAR IDENTITY DESIGNER</span>
          <h2>{draft.name || 'Custom Persona'}</h2>
          <p>Tune visual traits, aesthetics, facial geometry, wardrobe, adult styling and scene controls.</p>
          <div className="chips">
            <span>{draft.ethnicity}</span><span>{draft.bodyType}</span>
            <span>{draft.hairColor} {draft.hairStyle}</span><span>{draft.eyeColor} eyes</span>
            <span>{draft.skinTone} skin</span><span>{draft.expression}</span>
            {adult && <span className="adult-chip">ADULT (18+)</span>}
            {adult && <span className="adult-chip">{adultSelections.nudityLevel.replace('_', ' ').toUpperCase()}</span>}
          </div>
        </div>
      </div>

      <div className="row" style={{ marginTop: 16 }}>
        <button type="button" onClick={handleRandomize}>🎲 RANDOMIZE TRAITS</button>
        <button type="button" onClick={() => { setDraft(initial as AdultDraft); setAdultSelections((initial as AdultDraft).adultSelections || defaultAdultSelections()); }}>↺ RESET</button>
        <button type="button" onClick={handleSave} style={{ background: savedNotice ? '#214d3c' : undefined, borderColor: savedNotice ? '#7ff0bd' : undefined }}>
          {savedNotice ? '✓ SAVED TO PERSONA' : '💾 SAVE IDENTITY'}
        </button>
        <button type="button" className="generate" onClick={handleGenerate}>✨ GENERATE AVATAR PORTRAIT</button>
      </div>

      <div className="editorGrid" style={{ marginTop: 16 }}>
        <label>Character Name<input type="text" value={draft.name} onChange={e => update('name', e.target.value)} /></label>
        <label>Age (18+)<input type="number" min={18} max={99} value={draft.age} onChange={e => update('age', Math.max(18, Number(e.target.value) || 18))} /></label>
        <label>Ethnicity / Heritage<select value={draft.ethnicity} onChange={e => update('ethnicity', e.target.value)}>{avatarOptions.ethnicity.map(o => <option key={o}>{label(o)}</option>)}</select></label>
        <label>Body Build<select value={draft.bodyType} onChange={e => update('bodyType', e.target.value)}>{avatarOptions.bodyType.map(o => <option key={o}>{label(o)}</option>)}</select></label>
        <label>Eye Color<select value={draft.eyeColor} onChange={e => update('eyeColor', e.target.value)}>{avatarOptions.eyeColor.map(o => <option key={o}>{label(o)}</option>)}</select></label>
        <label>Eye Shape<select value={draft.eyeShape} onChange={e => update('eyeShape', e.target.value)}>{avatarOptions.eyeShape.map(o => <option key={o}>{label(o)}</option>)}</select></label>
        <label>Face Shape<select value={draft.faceShape} onChange={e => update('faceShape', e.target.value)}>{avatarOptions.faceShape.map(o => <option key={o}>{label(o)}</option>)}</select></label>
        <label>Hair Color<select value={draft.hairColor} onChange={e => update('hairColor', e.target.value)}>{avatarOptions.hairColor.map(o => <option key={o}>{label(o)}</option>)}</select></label>
        <label>Hair Style<select value={draft.hairStyle} onChange={e => update('hairStyle', e.target.value)}>{avatarOptions.hairStyle.map(o => <option key={o}>{label(o)}</option>)}</select></label>
        <label>Skin Tone<select value={draft.skinTone} onChange={e => update('skinTone', e.target.value)}>{avatarOptions.skinTone.map(o => <option key={o}>{label(o)}</option>)}</select></label>
        <label>Wardrobe / Outfit<select value={draft.outfit} onChange={e => update('outfit', e.target.value)}>{avatarOptions.outfit.map(o => <option key={o}>{label(o)}</option>)}</select></label>
        <label>Pose & Framing<select value={draft.pose} onChange={e => update('pose', e.target.value)}>{avatarOptions.pose.map(o => <option key={o}>{label(o)}</option>)}</select></label>
        <label>Expression<select value={draft.expression} onChange={e => update('expression', e.target.value)}>{avatarOptions.expression.map(o => <option key={o}>{label(o)}</option>)}</select></label>
      </div>

      {adult && (
        <section className="adult-editor" style={{ marginTop: 20 }}>
          <div className="result">
            <span className="eyebrow">18+ ADULT STUDIO</span>
            <h3>Adult presentation controls</h3>
            <p>All characters are fictional consenting adults aged 18+. Artistic nudity is limited to non-graphic fine-art/editorial presentation.</p>
          </div>
          <div className="editorGrid" style={{ marginTop: 12 }}>
            {select('nudityLevel', adultOptions.nudityLevel)}
            {select('wardrobe', adultOptions.wardrobe)}
            {select('coverage', adultOptions.coverage)}
            {select('pose', adultOptions.pose)}
            {select('bodyPresentation', adultOptions.bodyPresentation)}
            {select('scene', adultOptions.scene)}
            {select('lighting', adultOptions.lighting)}
            {select('camera', adultOptions.camera)}
            {select('styling', adultOptions.styling)}
            {select('accessories', adultOptions.accessories)}
            {select('mood', adultOptions.mood)}
          </div>
        </section>
      )}

      <label style={{ marginTop: 12 }}>
        Extra Features & Atmosphere
        <textarea value={draft.extra} onChange={e => update('extra', e.target.value)} placeholder="Lighting, jewelry, aesthetic details, character notes..." />
      </label>

      <article className="result" style={{ marginTop: 16 }}>
        <span className="eyebrow">COMPILED PROMPT SPECIFICATION</span>
        <p style={{ fontSize: 13, color: '#ccc' }}>{promptPreview}</p>
        <small>This compiled specification is dispatched to the selected provider when generating.</small>
      </article>
    </div>
  );
}
