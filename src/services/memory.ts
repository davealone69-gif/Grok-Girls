import { Girl } from '../models/studio';
const KEY='grok-girls-state-v1';
export function loadGirls(fallback:Girl[]):Girl[]{ try{return JSON.parse(localStorage.getItem(KEY)||'')||fallback}catch{return fallback} }
export function saveGirls(girls:Girl[]){localStorage.setItem(KEY,JSON.stringify(girls));}
export function remember(girls:Girl[],id:string,text:string):Girl[]{return girls.map(g=>g.id===id?{...g,memories:[text,...g.memories].slice(0,20),affinity:Math.min(100,g.affinity+1)}:g)}
