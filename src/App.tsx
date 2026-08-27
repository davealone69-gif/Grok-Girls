import React,{useMemo,useState} from 'react';
import {Girl,Mode,seedGirls,buildPrompt} from './models/studio';
import {loadGirls,remember,saveGirls} from './services/memory';
import './styles.css';

export default function App(){
 const [girls,setGirls]=useState<Girl[]>(()=>loadGirls(seedGirls));
 const [selectedId,setSelectedId]=useState(girls[0].id); const [mode,setMode]=useState<Mode>('image'); const [prompt,setPrompt]=useState(''); const [enhanced,setEnhanced]=useState(true); const [result,setResult]=useState('');
 const girl=useMemo(()=>girls.find(g=>g.id===selectedId)!,[girls,selectedId]);
 const generate=()=>{const p=buildPrompt(girl,prompt,mode,enhanced);setResult(p);const next=remember(girls,girl.id,`${mode}: ${prompt||'showcase scene'}`);setGirls(next);saveGirls(next)};
 return <main><header><div><span className="eyebrow">GROK GIRLS</span><h1>Character Studio</h1><p>Personas, memory, rooms and cinematic generation in one control room.</p></div><div className="status">● LOCAL STATE</div></header>
 <section className="layout"><aside><h2>Girls</h2>{girls.map(g=><button className={g.id===selectedId?'girl active':'girl'} onClick={()=>setSelectedId(g.id)} key={g.id}><span className="avatar">{g.name[0]}</span><span><b>{g.name}</b><small>{g.room} · {g.affinity}%</small></span></button>)}</aside>
 <section className="studio"><div className="hero"><div className="orb">{girl.name[0]}</div><div><span className="eyebrow">ACTIVE PERSONA</span><h2>{girl.name}</h2><p>{girl.bio}</p><div className="chips">{girl.traits.map(t=><span key={t}>{t}</span>)}</div></div></div>
 <div className="controls"><label>Scene prompt<textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Describe the scene, outfit, mood, camera or story..."/></label><div className="row"><button className={mode==='image'?'selected':''} onClick={()=>setMode('image')}>IMAGE</button><button className={mode==='video'?'selected':''} onClick={()=>setMode('video')}>VIDEO</button><button className={enhanced?'selected':''} onClick={()=>setEnhanced(v=>!v)}>ENHANCE</button><button className="generate" onClick={generate}>GENERATE</button></div></div>
 {result&&<article className="result"><span className="eyebrow">PROMPT PIPELINE</span><p>{result}</p><small>Memory recorded for {girl.name}. Affinity now {girls.find(g=>g.id===girl.id)?.affinity}%.</small></article>}
 <div className="memory"><h3>Memory matrix</h3>{girl.memories.length?<ul>{girl.memories.slice(0,5).map((m,i)=><li key={i}>{m}</li>)}</ul>:<p>No memories yet. Generate a scene to seed the relationship layer.</p>}</div>
 </section></section></main>
}
