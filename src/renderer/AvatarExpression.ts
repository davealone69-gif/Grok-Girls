export interface AvatarExpression { smile:number; blink:number; brow:number; jaw:number; }
export const NEUTRAL_EXPRESSION:AvatarExpression={smile:0,blink:0,brow:0,jaw:0};
export function clampExpression(e:AvatarExpression):AvatarExpression{return{smile:Math.max(-1,Math.min(1,e.smile)),blink:Math.max(0,Math.min(1,e.blink)),brow:Math.max(-1,Math.min(1,e.brow)),jaw:Math.max(0,Math.min(1,e.jaw))};}
