export type AvatarRenderFormat='png'|'webp';
export function mimeForAvatarRender(format:AvatarRenderFormat):string{return format==='webp'?'image/webp':'image/png';}
