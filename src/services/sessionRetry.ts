export function retryDelay(attempt:number,base=400,max=8000):number{const n=Math.max(0,Math.min(8,Math.floor(attempt)));return Math.min(max,base*Math.pow(2,n));}
