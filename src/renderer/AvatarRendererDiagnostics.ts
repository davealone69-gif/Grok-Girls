export interface AvatarRendererDiagnostics { drawCalls:number; triangles:number; width:number; height:number; hdr:boolean; timestamp:number; }
export function createRendererDiagnostics(width:number,height:number,hdr:boolean,drawCalls=0,triangles=0):AvatarRendererDiagnostics{return{drawCalls,triangles,width,height,hdr,timestamp:Date.now()};}
