import {Girl,Room} from '../models/studio';
export interface ChatMessage{id:string;role:'user'|'assistant';text:string;createdAt:number}
const KEY='grok-girls-chat-v1';
export function loadChat(id:string):ChatMessage[]{try{return JSON.parse(localStorage.getItem(`${KEY}:${id}`)||'[]') as ChatMessage[]}catch{return[]}}
export function saveChat(id:string,messages:ChatMessage[]){localStorage.setItem(`${KEY}:${id}`,JSON.stringify(messages.slice(-200)))}
export function localReply(girl:Girl,room:Room,message:string):string{const m=message.toLowerCase();if(m.includes('hello')||m.includes('hi')||m.includes('hey'))return `${girl.name}: Good to see you. We're in the ${room.name} tonight. What are we creating?`;if(m.includes('room'))return `${girl.name}: The ${room.name} is set up with ${room.lighting.toLowerCase()}.`;if(m.includes('remember'))return girl.memories.length?`${girl.name}: I have ${girl.memories.length} saved memory entries for this persona.`:`${girl.name}: Nothing saved yet. Give me something worth remembering.`;return `${girl.name}: I'm in local mode and heard you. I can keep the conversation here, then hand the request to a configured AI provider when one is available.`}
