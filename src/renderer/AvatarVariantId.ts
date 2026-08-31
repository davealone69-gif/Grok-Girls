export type AvatarVariantId=string;
export function normaliseAvatarVariantId(value:string):AvatarVariantId{const v=value.trim().toLowerCase().replace(/[^a-z0-9_-]/g,'-');return v.slice(0,96)||'default';}
