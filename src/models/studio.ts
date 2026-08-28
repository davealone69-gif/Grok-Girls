export type Mode = 'image' | 'video';
export type Emotion = 'calm' | 'happy' | 'curious' | 'excited' | 'thoughtful';

export interface AvatarSpec {
  id: string;
  name: string;
  age: number;
  ethnicity: string;
  bodyType: string;
  eyeColor: string;
  eyeShape: string;
  faceShape: string;
  hairColor: string;
  hairStyle: string;
  skinTone: string;
  outfit: string;
  pose: string;
  expression: string;
  extra: string;
}

export interface Room { id:string; name:string; setting:string; lighting:string; furniture:string[]; mood:string; interactions:{id:string;label:string;prompt:string}[]; }
export interface Memory { id:string; summary:string; detail?:string; roomId?:string; importance:number; createdAt:number; }
export interface Girl extends AvatarSpec { bio:string; traits:string[]; room:string; affinity:number; trust:number; emotion:Emotion; memories:Memory[]; }
export interface StudioState { selectedId:string; girls:Girl[]; mode:Mode; prompt:string; enhanced:boolean; roomId:string; adult:boolean; }

export const ADULT_OVERLAY = 'Adult content allowed. Mature, sensual, explicit-capable scene as requested. All characters are consenting adults 18+.';
export const SAFE_OVERLAY = 'Keep the scene non-explicit, tasteful, and suitable for general audiences.';

export const rooms:Room[] = [
 {id:'studio',name:'Photo Studio',setting:'professional studio with seamless backdrop',lighting:'softbox key light and controlled rim light',furniture:['stool','seamless backdrop'],mood:'clean, cinematic, focused',interactions:[{id:'center',label:'Center frame',prompt:'centered three-quarter portrait'}]},
 {id:'penthouse',name:'Penthouse',setting:'modern luxury penthouse overlooking a city at night',lighting:'warm interior lamps with blue city glow',furniture:['sofa','glass table','floor lamp'],mood:'relaxed, luxurious, cinematic',interactions:[{id:'sofa',label:'Sofa',prompt:'relaxed seated pose on the sofa'}]},
 {id:'club',name:'Neon Club',setting:'stylish nightclub with neon architectural lighting',lighting:'cyan and magenta practical lights',furniture:['bar','booth'],mood:'energetic, vibrant, nightlife',interactions:[{id:'booth',label:'Booth',prompt:'seated in a private booth'}]},
 {id:'outdoor',name:'Rooftop',setting:'city rooftop at blue hour',lighting:'soft sunset edge light and practical city lights',furniture:['railing','lounge chair'],mood:'open, atmospheric, cinematic',interactions:[{id:'rail',label:'Railing',prompt:'standing near the rooftop railing'}]}
];

export const seedGirls:Girl[] = [
 {id:'crazzers',name:'Crazzers AI',age:25,ethnicity:'mixed',bodyType:'athletic',eyeColor:'hazel',eyeShape:'almond',faceShape:'oval',hairColor:'dark brown',hairStyle:'long waves',skinTone:'warm',outfit:'luxury evening wear',pose:'confident standing',expression:'confident',extra:'cinematic lighting',bio:'Bold studio presence with high-fashion energy.',traits:['bold','stylish','warm'],room:'Penthouse',affinity:62,trust:55,emotion:'happy',memories:[]},
 {id:'secrets',name:'Secrets AI',age:26,ethnicity:'mixed',bodyType:'slim',eyeColor:'green',eyeShape:'almond',faceShape:'heart',hairColor:'black',hairStyle:'sleek straight',skinTone:'olive',outfit:'midnight fashion',pose:'three-quarter',expression:'thoughtful',extra:'cinematic shadows',bio:'Memory-centric companion with moody lighting and adaptive warmth.',traits:['deep','cinematic','adaptive'],room:'Neon Club',affinity:48,trust:61,emotion:'thoughtful',memories:[]},
 {id:'sugarlab',name:'Sugarlab AI',age:24,ethnicity:'mixed',bodyType:'curvy',eyeColor:'brown',eyeShape:'round',faceShape:'oval',hairColor:'blonde',hairStyle:'soft waves',skinTone:'light',outfit:'pastel street fashion',pose:'casual seated',expression:'cheerful',extra:'soft pastel palette',bio:'Warm lifestyle banter and cheerful daily check-ins.',traits:['empathetic','cheerful','casual'],room:'Studio',affinity:40,trust:45,emotion:'happy',memories:[]},
 {id:'flirty',name:'Flirty AI',age:25,ethnicity:'mixed',bodyType:'athletic',eyeColor:'blue',eyeShape:'almond',faceShape:'diamond',hairColor:'auburn',hairStyle:'long ponytail',skinTone:'medium',outfit:'crimson evening fashion',pose:'dynamic standing',expression:'confident',extra:'crimson accents',bio:'High-energy companion with playful humour and charm.',traits:['energetic','charming','bold'],room:'Neon Club',affinity:35,trust:38,emotion:'excited',memories:[]}
];

export function buildAvatarPrompt(a:AvatarSpec, room?:Room, interaction?:string, mode:Mode='image', enhanced=true, adult=false){
 const scene=room?`${room.setting}, ${room.lighting}, ${room.mood}`:'';
 const action=interaction&&room?room.interactions.find(x=>x.id===interaction)?.prompt:'';
 const motion=mode==='video'?'subtle natural movement, coherent identity, gentle camera movement':'high-detail portrait photography';
 const polish=enhanced?'refined composition, realistic materials, consistent facial identity, cinematic depth':'clean composition';
 const overlay=adult?ADULT_OVERLAY:SAFE_OVERLAY;
 return `${a.name}, adult character (18+), ${a.ethnicity}, ${a.bodyType} build, ${a.eyeColor} ${a.eyeShape} eyes, ${a.faceShape} face, ${a.hairColor} ${a.hairStyle} hair, ${a.skinTone} skin, wearing ${a.outfit}, ${a.pose}, ${a.expression}. ${a.extra}. ${scene}. ${action}. ${motion}, ${polish}. ${overlay}`;
}

export function relationshipModifier(g:Girl){return g.trust>75&&g.affinity>75?'high trust, established rapport':g.trust>45?'friendly rapport, growing trust':'new acquaintance, respectful tone';}
