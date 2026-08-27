export type ProviderName='local'|'openrouter'|'gemini'|'custom';
export interface GenerationRequest{prompt:string;mode:'image'|'video';width?:number;height?:number;steps?:number;cfg?:number;seed?:number;}
export interface GenerationResult{provider:ProviderName;status:'ready'|'queued'|'fallback'|'error';text?:string;assetUrl?:string;warning?:string;}
export interface Provider{readonly name:ProviderName;available():boolean;generate(request:GenerationRequest):Promise<GenerationResult>}

class LocalProvider implements Provider{
 readonly name='local' as const;
 available(){return true}
 async generate(request:GenerationRequest):Promise<GenerationResult>{
  return {provider:this.name,status:'fallback',text:`Local ${request.mode} pipeline prepared. No cloud model is configured, so the app remains usable offline.`,warning:'Connect a supported provider to render a real asset.'};
 }
}

class HttpProvider implements Provider{
 constructor(public readonly name:Exclude<ProviderName,'local'>,private endpoint:string,private key:string){}
 available(){return Boolean(this.endpoint&&this.key)}
 async generate(request:GenerationRequest):Promise<GenerationResult>{
  if(!this.available())return {provider:this.name,status:'error',warning:`${this.name} is not configured.`};
  try{const response=await fetch(this.endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${this.key}`},body:JSON.stringify(request)});if(!response.ok)throw new Error(`HTTP ${response.status}`);const data=await response.json() as {url?:string;text?:string};return {provider:this.name,status:request.mode==='video'?'queued':'ready',assetUrl:data.url,text:data.text}}catch(error){return {provider:this.name,status:'error',warning:error instanceof Error?error.message:'Generation failed'}}
 }
}

export function providers():Provider[]{const env=import.meta.env as Record<string,string|undefined>;return [new LocalProvider(),new HttpProvider('openrouter',env.VITE_OPENROUTER_ENDPOINT??'',env.VITE_OPENROUTER_API_KEY??''),new HttpProvider('gemini',env.VITE_GEMINI_ENDPOINT??'',env.VITE_GEMINI_API_KEY??''),new HttpProvider('custom',env.VITE_CUSTOM_AI_ENDPOINT??'',env.VITE_CUSTOM_AI_KEY??'')]}
export async function generateWithFallback(request:GenerationRequest,preferred:ProviderName='local'){const list=providers();const ordered=[...list.filter(p=>p.name===preferred),...list.filter(p=>p.name!==preferred)];for(const provider of ordered){if(!provider.available())continue;const result=await provider.generate(request);if(result.status==='ready'||result.status==='queued'||provider.name==='local')return result}return {provider:'local',status:'fallback',warning:'No generation provider is available.'} as GenerationResult}
