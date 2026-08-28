import React, {useState} from 'react';
import type {AvatarDraft} from '../services/avatarCreator';

interface Props {
  initial: AvatarDraft;
  mode?: string;
  roomId?: string;
  onSave: (draft: AvatarDraft) => void;
  onGenerate: (draft: AvatarDraft) => void;
}

const fields: (keyof AvatarDraft)[] = [
  'name','age','ethnicity','bodyType','eyeColor','eyeShape','faceShape',
  'hairColor','hairStyle','skinTone','outfit','pose','expression','extra'
];

export default function AvatarCreator({initial, onSave, onGenerate}: Props) {
  const [draft, setDraft] = useState<AvatarDraft>(initial);
  const set = (key: keyof AvatarDraft, value: string) =>
    setDraft(d => ({...d, [key]: key === 'age' ? Number(value) || 0 : value}));

  return (
    <div>
      <article className="hero">
        <div>
          <span className="eyebrow">AVATAR CREATOR</span>
          <h2>{draft.name || 'New persona'}</h2>
          <p>Edit traits, then save or generate a portrait.</p>
        </div>
      </article>
      <div className="editorGrid">
        {fields.map(key => (
          <label key={key}>
            {key}
            <input
              value={String(draft[key] ?? '')}
              onChange={e => set(key, e.target.value)}
            />
          </label>
        ))}
      </div>
      <div className="row">
        <button onClick={() => onSave(draft)}>SAVE</button>
        <button className="generate" onClick={() => onGenerate(draft)}>GENERATE AVATAR</button>
      </div>
    </div>
  );
}
