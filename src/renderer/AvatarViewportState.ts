export interface AvatarViewportState { width:number;height:number;devicePixelRatio:number;visible:boolean; }
export const DEFAULT_VIEWPORT_STATE:AvatarViewportState={width:1,height:1,devicePixelRatio:1,visible:true};
export function updateViewportState(s:AvatarViewportState,width:number,height:number,dpr=1):AvatarViewportState{return{...s,width:Math.max(1,Math.floor(width)),height:Math.max(1,Math.floor(height)),devicePixelRatio:Math.max(.5,Math.min(4,dpr))};}
