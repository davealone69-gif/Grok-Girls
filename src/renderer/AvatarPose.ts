export interface AvatarPose { yaw:number; pitch:number; roll:number; }
export const DEFAULT_AVATAR_POSE:AvatarPose={yaw:0,pitch:0,roll:0};
export function clampAvatarPose(p:AvatarPose):AvatarPose{return{yaw:Math.max(-90,Math.min(90,p.yaw)),pitch:Math.max(-45,Math.min(45,p.pitch)),roll:Math.max(-30,Math.min(30,p.roll))};}
