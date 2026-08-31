export interface SessionEvent { type:string; at:number; data?:Record<string,unknown>; }
export class SessionEventLog { private events:SessionEvent[]=[]; push(type:string,data?:Record<string,unknown>){this.events.push({type,at:Date.now(),data});} snapshot(){return this.events.slice();} clear(){this.events=[];} }
