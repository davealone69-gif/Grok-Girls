import React, { useState, useEffect } from 'react';
import { AvatarDraft, avatarOptions, randomizeAvatar, buildDraftPrompt } from '../services/avatarCreator';
import { Mode } from '../models/studio';

export interface AvatarCreatorProps {
  initial: AvatarDraft;
  mode?: Mode;
  roomId?: string;
  onSave?: (draft: AvatarDraft) => void;
  onGenerate?: (draft: AvatarDraft) => void;
  adult?: boolean;
}

export default function AvatarCreator({
  initial,
  onSave,
  onGenerate,
  adult = false
}: AvatarCreatorProps) {
  const [draft, setDraft] = useState<AvatarDraft>(initial);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    setDraft(initial);
  }, [initial.id]);

  const update = <K extends keyof AvatarDraft>(key: K, value: AvatarDraft[K]) => {
    setDraft(prev => {
      const next = { ...prev, [key]: value };
      return next;
    });
  };

  const handleSave = () => {
    onSave?.(draft);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2200);
  };

  const handleGenerate = () => {
    onSave?.(draft);
    onGenerate?.(draft);
  };

  const handleRandomize = () => {
    const randomized = randomizeAvatar(draft);
    setDraft(randomized);
    onSave?.(randomized);
  };

  const promptPreview = buildDraftPrompt(draft, adult);

  return (
    <div className="avatar-creator-panel">
      <div className="hero">
        <div className="orb">{draft.name ? draft.name[0].toUpperCase() : 'A'}</div>
        <div>
          <span className="eyebrow">AVATAR IDENTITY DESIGNER</span>
          <h2>{draft.name || 'Custom Persona'}</h2>
          <p>
            Tune visual traits, aesthetics, facial geometry, and wardrobe for coherent AI rendering.
          </p>
          <div className="chips">
            <span>{draft.ethnicity}</span>
            <span>{draft.bodyType}</span>
            <span>{draft.hairColor} {draft.hairStyle}</span>
            <span>{draft.eyeColor} eyes</span>
            <span>{draft.skinTone} skin</span>
            <span>{draft.expression}</span>
            {adult && <span className="adult-chip">ADULT (18+)</span>}
          </div>
        </div>
      </div>

      <div className="row" style={{ marginTop: 16 }}>
        <button type="button" onClick={handleRandomize}>
          🎲 RANDOMIZE TRAITS
        </button>
        <button type="button" onClick={() => setDraft(initial)}>
          ↺ RESET
        </button>
        <button
          type="button"
          onClick={handleSave}
          style={{ background: savedNotice ? '#214d3c' : undefined, borderColor: savedNotice ? '#7ff0bd' : undefined }}
        >
          {savedNotice ? '✓ SAVED TO PERSONA' : '💾 SAVE IDENTITY'}
        </button>
        <button type="button" className="generate" onClick={handleGenerate}>
          ✨ GENERATE AVATAR PORTRAIT
        </button>
      </div>

      <div className="editorGrid" style={{ marginTop: 16 }}>
        <label>
          Character Name
          <input
            type="text"
            value={draft.name}
            onChange={e => update('name', e.target.value)}
            placeholder="e.g. Maya AI"
          />
        </label>

        <label>
          Age (18+)
          <input
            type="number"
            min={18}
            max={99}
            value={draft.age}
            onChange={e => update('age', Math.max(18, Number(e.target.value) || 18))}
          />
        </label>

        <label>
          Ethnicity / Heritage
          <select
            value={draft.ethnicity}
            onChange={e => update('ethnicity', e.target.value)}
          >
            {avatarOptions.ethnicity.map(opt => (
              <option key={opt} value={opt}>
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Body Build
          <select
            value={draft.bodyType}
            onChange={e => update('bodyType', e.target.value)}
          >
            {avatarOptions.bodyType.map(opt => (
              <option key={opt} value={opt}>
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Eye Color
          <select
            value={draft.eyeColor}
            onChange={e => update('eyeColor', e.target.value)}
          >
            {avatarOptions.eyeColor.map(opt => (
              <option key={opt} value={opt}>
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Eye Shape
          <select
            value={draft.eyeShape}
            onChange={e => update('eyeShape', e.target.value)}
          >
            {avatarOptions.eyeShape.map(opt => (
              <option key={opt} value={opt}>
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Face Shape
          <select
            value={draft.faceShape}
            onChange={e => update('faceShape', e.target.value)}
          >
            {avatarOptions.faceShape.map(opt => (
              <option key={opt} value={opt}>
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Hair Color
          <select
            value={draft.hairColor}
            onChange={e => update('hairColor', e.target.value)}
          >
            {avatarOptions.hairColor.map(opt => (
              <option key={opt} value={opt}>
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Hair Style
          <select
            value={draft.hairStyle}
            onChange={e => update('hairStyle', e.target.value)}
          >
            {avatarOptions.hairStyle.map(opt => (
              <option key={opt} value={opt}>
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Skin Tone
          <select
            value={draft.skinTone}
            onChange={e => update('skinTone', e.target.value)}
          >
            {avatarOptions.skinTone.map(opt => (
              <option key={opt} value={opt}>
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Wardrobe / Outfit
          <select
            value={draft.outfit}
            onChange={e => update('outfit', e.target.value)}
          >
            {avatarOptions.outfit.map(opt => (
              <option key={opt} value={opt}>
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Pose & Framing
          <select
            value={draft.pose}
            onChange={e => update('pose', e.target.value)}
          >
            {avatarOptions.pose.map(opt => (
              <option key={opt} value={opt}>
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Expression
          <select
            value={draft.expression}
            onChange={e => update('expression', e.target.value)}
          >
            {avatarOptions.expression.map(opt => (
              <option key={opt} value={opt}>
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label style={{ marginTop: 12 }}>
        Extra Features & Atmosphere (Tattoos, Jewelry, Lighting cues, Specific aesthetic details)
        <textarea
          value={draft.extra}
          onChange={e => update('extra', e.target.value)}
          placeholder="e.g. subtle cat-eye eyeliner, gold hoop earrings, soft studio bokeh, cinematic rim lighting"
        />
      </label>

      <article className="result" style={{ marginTop: 16 }}>
        <span className="eyebrow">COMPILED PROMPT SPECIFICATION</span>
        <p style={{ fontSize: 13, color: '#ccc' }}>{promptPreview}</p>
        <small>This exact prompt specification is dispatched to the chosen AI provider when generating portraits.</small>
      </article>
    </div>
  );
}
