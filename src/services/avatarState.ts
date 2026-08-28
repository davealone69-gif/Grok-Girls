import {Emotion,Girl} from '../models/studio';
const KEY='grok-girls-avatar-state-v1';
export interface AvatarState { mood:number; energy:number; trust:number; affection:number; confidence:number; emotion:Emotion; roomId?:string; lastEvent:string; updatedAt:number; }
const clamp=(v:number)=>Math.max(0,Math.min(100,v));
export function loadAvatarState(id:string,girl:Girl):AvatarState{try{return JSON.parse(localStorage.getItem(`${KEY}:${id}`)||'') as AvatarState}catch{return {mood:50,energy:100,trust:girl.trust,affection:girl.affinity,confidence:60,emotion:girl.emotion,roomId:undefined,lastEvent:'',updatedAt:Date.now()}}}
export function saveAvatarState(id:string,state:AvatarState){localStorage.setItem(`${KEY}:${id}`,JSON.stringify(state))}
export function interactionState(state:AvatarState,deltaAffection=3,deltaTrust=2):AvatarState{const affection=clamp(state.affection+deltaAffection);const trust=clamp(state.trust+deltaTrust);const mood=clamp(state.mood+2);const energy=clamp(state.energy-2);const emotion:Emotion=energy<25?'thoughtful':mood>75&&affection>50?'happy':mood>60?'excited':trust<20?'thoughtful':'calm';return {...state,affection,trust,mood,energy,emotion,updatedAt:Date.now()}}
export function statePrompt(s:AvatarState):string{return `emotion: ${s.emotion}, mood ${Math.round(s.mood)}%, energy ${Math.round(s.energy)}%, trust ${Math.round(s.trust)}%, affection ${Math.round(s.affection)}%, confidence ${Math.round(s.confidence)}%${s.lastEvent?`, recent event: ${s.lastEvent}`:''}`}
