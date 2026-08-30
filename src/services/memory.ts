import {Girl,Memory,Mode,Room,seedGirls,buildAvatarPrompt,relationshipModifier,ADULT_OVERLAY,SAFE_OVERLAY} from '../models/studio';
import {AvatarState,statePrompt} from './avatarState';
import {StoryState,storyPrompt} from '../models/story';
import { matchAct, actMemory, NSFW_NEGATIVE } from './adultActs';
const KEY='grok-girls-state-v2';
function sanitizeGirl(g: Girl): Girl {
  const seed = seedGirls.find(s => s.id === g.id);
  if (!seed) return g;
  const bad = (u?: string) => !u || u.startsWith('blob:') || u.startsWith('data:');
  const out = { ...g };
  if (bad(out.previewUrl) && seed.previewUrl) out.previewUrl = seed.previewUrl;
  if (bad(out.thumbnailUrl) && seed.thumbnailUrl) out.thumbnailUrl = seed.thumbnailUrl;
  return out;
}

export function loadGirls(fallback:Girl[]):Girl[]{try{const raw=localStorage.getItem(KEY);if(!raw)return fallback;const parsed=JSON.parse(raw) as Girl[];if(!Array.isArray(parsed)||!parsed.length)return fallback;const cleaned=parsed.map(sanitizeGirl);const changed=cleaned.some((g,i)=>g.previewUrl!==parsed[i].previewUrl||g.thumbnailUrl!==parsed[i].thumbnailUrl);if(changed)saveGirls(cleaned);const have=new Set(cleaned.map(g=>g.id));const missing=fallback.filter(g=>!have.has(g.id));return missing.length?[...missing,...cleaned]:cleaned}catch{return fallback}}
export function saveGirls(girls:Girl[]){localStorage.setItem(KEY,JSON.stringify(girls))}
export function addMemory(girls:Girl[],id:string,summary:string,detail:string,roomId?:string,importance=0.45):Girl[]{const memory:Memory={id:crypto.randomUUID?.()??String(Date.now()),summary,detail,roomId,importance,createdAt:Date.now()};return girls.map(g=>g.id===id?{...g,memories:[memory,...g.memories].slice(0,100),affinity:Math.min(100,g.affinity+1),trust:Math.min(100,g.trust+.5)}:g)}

/** Auto-log explicit acts as high-importance memories */
export function addActMemory(girls:Girl[],id:string,userMessage:string,roomId?:string):Girl[]{
  const act=matchAct(userMessage);
  if(!act)return girls;
  const {summary,boost}=actMemory(act.id);
  const memory:Memory={id:crypto.randomUUID?.()??String(Date.now()),summary,detail:act.chatReply,roomId,importance:0.85,createdAt:Date.now()};
  return girls.map(g=>g.id===id?{...g,memories:[memory,...g.memories].slice(0,100),affinity:Math.min(100,g.affinity+boost),trust:Math.min(100,g.trust+boost*0.4)}:g);
}

export function contextMemories(girl:Girl,roomId?:string,limit=6):Memory[]{return [...girl.memories].map(m=>({...m,score:m.importance+(m.roomId===roomId?.2:0)+(1/(1+(Date.now()-m.createdAt)/86400000))*.3})).sort((a,b)=>(b.score??0)-(a.score??0)).slice(0,limit)}
export function buildGenerationPrompt(girl:Girl,room:Room,prompt:string,mode:Mode,enhanced:boolean,interaction?:string,state?:AvatarState,story?:StoryState,adult=false){const memories=contextMemories(girl,room.id).map(m=>m.summary).join('; ');const dynamic=state?` ${statePrompt(state)}.`:'';const narrative=story?` ${storyPrompt(story)}`:'';const overlay=adult?ADULT_OVERLAY:SAFE_OVERLAY;const defaultDir=adult?'Create an explicit graphic sexual scene as requested, detailed anatomy, fluids, intense pleasure':'Create a polished showcase scene';const neg=adult?` Negative prompt: ${NSFW_NEGATIVE}.`:'';return `${buildAvatarPrompt(girl,room,interaction,mode,enhanced,adult)} Relationship: ${relationshipModifier(girl)}.${dynamic}${narrative} ${memories?`Relevant memory: ${memories}.`:''} User direction: ${prompt.trim()||defaultDir}. Content policy: ${overlay}${neg}`}
