export interface AvatarCamera { position:[number,number,number]; target:[number,number,number]; fov:number; }
export const DEFAULT_AVATAR_CAMERA:AvatarCamera={position:[0,1.35,3.2],target:[0,.95,0],fov:38};
export function cloneAvatarCamera(c:AvatarCamera):AvatarCamera{return{position:[...c.position] as [number,number,number],target:[...c.target] as [number,number,number],fov:c.fov};}
