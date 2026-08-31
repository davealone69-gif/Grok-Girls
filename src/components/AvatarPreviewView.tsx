/* ------------------------------------------------------------------ */
/* AvatarPreviewView — mirror of the Kotlin custom View.               */
/*                                                                     */
/*   class AvatarPreviewView : View {                                  */
/*     private var avatar = AvatarDefinition()                         */
/*     fun setAvatar(definition: AvatarDefinition) {                   */
/*       avatar = definition; invalidate()                             */
/*     }                                                               */
/*     override fun onDraw(canvas: Canvas) {                           */
/*       canvas.drawText("AVATAR PREVIEW", width/2f, height/2f, ...)   */
/*     }                                                               */
/*   }                                                                 */
/*                                                                     */
/* The imperative handle exposes the exact setAvatar() API — callers   */
/* (native-style surfaces, tests) can invalidate the draw at will.     */
/* onDraw is mirrored as a definition-driven status line rendered      */
/* over the procedural preview; it re-renders on every setAvatar.      */
/* ------------------------------------------------------------------ */
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { CSSProperties, ReactEventHandler } from 'react';
import type { AvatarDefinition } from '../models/avatarDefinition';

export interface AvatarPreviewHandle {
  /** Kotlin `fun setAvatar(definition)` mirror — updates + invalidate(). */
  setAvatar(definition: AvatarDefinition): void;
}

interface AvatarPreviewViewProps {
  definition: AvatarDefinition;
  src: string;
  alt: string;
  onError?: ReactEventHandler<HTMLImageElement>;
  imgStyle?: CSSProperties;
}

export const AvatarPreviewView = forwardRef<AvatarPreviewHandle, AvatarPreviewViewProps>(
  function AvatarPreviewView({ definition, src, alt, onError, imgStyle }, ref) {
    // private var avatar = AvatarDefinition()
    const [avatar, setAvatarState] = useState<AvatarDefinition>(definition);
    useEffect(() => setAvatarState(definition), [definition]);

    // fun setAvatar(definition) { avatar = definition; invalidate() }
    useImperativeHandle(ref, () => ({
      setAvatar: (def: AvatarDefinition) => setAvatarState(def)
    }));

    return (
      <>
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="character-image"
          onError={onError}
          style={imgStyle}
        />
        {/* onDraw(canvas): AVATAR PREVIEW, definition-driven */}
        <div className="preview-draw-status" aria-hidden="true">
          AVATAR PREVIEW · {avatar.gender} · {avatar.skin} · {avatar.hair}
        </div>
      </>
    );
  }
);
