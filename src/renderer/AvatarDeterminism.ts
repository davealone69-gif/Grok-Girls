export function hashSeed(seed:string):number{let h=2166136261>>>0;for(let i=0;i<seed.length;i++){h^=seed.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h>>>0;}
export function seededUnit(seed:string,index=0):number{let h=hashSeed(`${seed}:${index}`);h^=h>>>16;h=Math.imul(h,2246822507)>>>0;h^=h>>>13;return(h>>>0)/4294967296;}
