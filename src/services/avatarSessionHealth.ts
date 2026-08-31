export type AvatarSessionHealth='idle'|'connecting'|'connected'|'degraded'|'failed'|'closed';
export interface AvatarSessionHealthState { state:AvatarSessionHealth; video:boolean; audio:boolean; participants:number; lastError?:string; updatedAt:number; }
export function deriveAvatarSessionHealth(video:boolean,audio:boolean,participants:number,error?:string):AvatarSessionHealth { if(error) return 'failed'; if(participants<=0) return 'connecting'; if(video&&audio) return 'connected'; return video||audio?'degraded':'connecting'; }
