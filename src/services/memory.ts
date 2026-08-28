import {Girl,Memory,Mode,Room,buildAvatarPrompt,relationshipModifier} from '../models/studio';
import {AvatarState,statePrompt} from './avatarState';
import {StoryState,storyPrompt} from '../models/story';
const KEY='grok-girls-state-v2';
export function loadGirls(fallback:Girl[]):Girl[]{try{const raw=localStorage.getItem(KEY);if(!raw)return fallback;const parsed=JSON.parse(raw) as Girl[];return Array.isArray(parsed)&&parsed.length?parsed:fallback}catch{return fallback}}
export function saveGirls(girls:Girl[]){localStorage.setItem(KEY,JSON.stringify(girls))}
export function addMemory(girls:Girl[],id:string,summary:string,detail:string,roomId?:string):Girl[]{const memory:Memory={id:crypto.randomUUID?.()??String(Date.now()),summary,detail,roomId,importance:.45,createdAt:Date.now()};return girls.map(g=>g.id===id?{...g,memories:[memory,...g.memories].slice(0,100),affinity:Math.min(100,g.affinity+1),trust:Math.min(100,g.trust+.5)}:g)}
export function contextMemories(girl:Girl,roomId?:string,limit=6):Memory[]{return [...girl.memories].map(m=>({...m,score:m.importance+(m.roomId===roomId?.2:0)+(1/(1+(Date.now()-m.createdAt)/86400000))*.3})).sort((a,b)=>(b.score??0)-(a.score??0)).slice(0,limit)}
export function buildGenerationPrompt(girl:Girl,room:Room,prompt:string,mode:Mode,enhanced:boolean,interaction?:string,state?:AvatarState,story?:StoryState){const memories=contextMemories(girl,room.id).map(m=>m.summary).join('; ');const dynamic=state?` ${statePrompt(state)}.`:'';const narrative=story?` ${storyPrompt(story)}`:'';return `${buildAvatarPrompt(girl,room,interaction,mode,enhanced)} Relationship: ${relationshipModifier(girl)}.${dynamic}${narrative} ${memories?`Relevant memory: ${memories}.`:''} User direction: ${prompt.trim()||'Create a polished showcase scene'}`}
