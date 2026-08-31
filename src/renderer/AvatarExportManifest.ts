export interface AvatarExportManifest { version:1; seed:string; renderer:string; width:number; height:number; format:'png'; createdAt:string; }
export function createAvatarExportManifest(seed:string,width:number,height:number):AvatarExportManifest{return{version:1,seed,renderer:'Grok-Girls-HD',width,height,format:'png',createdAt:new Date().toISOString()};}
