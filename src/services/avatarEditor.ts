import type { Girl } from '../models/studio';
const KEY='grok-girls-avatar-editor-v1';
export const avatarOptions={bodyType:['petite','slim','athletic','curvy','hourglass'],eyeColor:['blue','green','brown','hazel','gray'],eyeShape:['almond','round','hooded','upturned'],faceShape:['oval','heart','round','square','diamond'],hairColor:['black','brown','blonde','auburn','red','white'],hairStyle:['short','bob','long straight','long waves','ponytail','braids'],skinTone:['fair','light','medium','tan','dark','deep','olive'],pose:['standing','sitting','three-quarter','walking','casual'],expression:['calm','happy','curious','thoughtful','confident'],outfit:['casual streetwear','evening fashion','studio fashion','athleisure','formal wear']};
export function saveAvatar(g:Girl){
  try{localStorage.setItem(`${KEY}:${g.id}`,JSON.stringify(g))}catch(e){console.warn('[avatar] could not persist avatar (storage full?)',e)}
}
