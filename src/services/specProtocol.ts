/* ------------------------------------------------------------------ */
/* specProtocol — the structured avatar-edit wire format.              */
/*                                                                     */
/* An LLM reply may end with ONE final line:                           */
/*                                                                     */
/*   🧬{"hairColor":"ruby red","hair":"long glamorous waves"}          */
/*                                                                     */
/* Kept to a single line so SSE/NDJSON streaming and display-stripping  */
/* are trivial. Engine-neutral: the protocol is a property of the APP, */
/* not of any one model server. The on-device Ollama engine is the    */
/* current consumer.                                                  */
/* ------------------------------------------------------------------ */

/** Sentinel that introduces the trailing structured line. */
export const SPEC_MARKER = '🧬';

/** System-prompt tail that teaches a model the structured-edit contract. */
export const SPEC_SYSTEM_TAIL = `\nIf the user asks you to create, change or design the avatar (appearance, hair, hair color, skin, body, eyes, makeup, outfit, pose, expression, scene/room or lighting), also end your reply with exactly one final line starting with ${SPEC_MARKER} followed by a single-line JSON object. Use only these keys when you have a value: hair, hairColor, skinTone, bodyType, eyes, eyeShape, faceShape, makeup, lipstick, brows, outfit, pose, expression, scene, lighting, choker, hosiery, tattoos, augments, gender, age. Values: prefer the exact wording you were given in the user's message; never invent values the user did not ask for, and never emit the ${SPEC_MARKER} line for ordinary conversation. Example of the final line: ${SPEC_MARKER}{"hairColor":"vibrant ruby red","hair":"long glamorous waves","makeup":"dark smokey eyeshadow with winged eyeliner","scene":"vintage tufted dark leather armchair, moody boudoir with crimson edge lighting"}`;

/**
 * Split the trailing 🧬 structured line out of a full reply.
 * Returns the display text (marker line removed) and the raw JSON payload.
 */
export function extractSpecBlock(text: string): { text: string; raw: string | null } {
  const lines = text.split('\n');
  const last = lines[lines.length - 1] ?? '';
  const idx = last.indexOf(SPEC_MARKER);
  if (idx === -1) return { text, raw: null };
  const raw = last.slice(idx + SPEC_MARKER.length).trim();
  const cleaned = lines.slice(0, lines.length - 1).join('\n').replace(/\s+$/, '');
  return { text: cleaned, raw: raw || null };
}
