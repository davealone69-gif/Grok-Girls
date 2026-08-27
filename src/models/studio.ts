export type Mode = 'image' | 'video';
export interface Girl { id:string; name:string; bio:string; traits:string[]; room:string; avatarUrl?:string; affinity:number; memories:string[]; }
export interface StudioState { selectedId:string; girls:Girl[]; mode:Mode; prompt:string; enhanced:boolean; }
export const seedGirls: Girl[] = [
 {id:'nova',name:'Nova',bio:'Confident creative with a sharp sense of humour.',traits:['confident','playful','creative'],room:'Neon Loft',affinity:62,memories:[]},
 {id:'aura',name:'Aura',bio:'Warm, curious and obsessed with cinematic lighting.',traits:['warm','curious','cinematic'],room:'Sunset Studio',affinity:48,memories:[]},
 {id:'vex',name:'Vex',bio:'Direct, chaotic-good designer who loves bold scenes.',traits:['direct','bold','designer'],room:'Industrial Room',affinity:35,memories:[]}
];
export function buildPrompt(g:Girl, prompt:string, mode:Mode, enhanced:boolean){
 const context=`${g.name}, ${g.traits.join(', ')}, in ${g.room}. ${g.bio}`;
 const suffix=mode==='video'?' cinematic motion, coherent character identity, camera movement':'high detail portrait, consistent character identity, studio lighting';
 return `${context}. ${prompt.trim()||'Create a polished showcase scene'}${enhanced?', refined composition and lighting':''}, ${suffix}.`;
}
