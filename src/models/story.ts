export interface StoryChapter { chapter:number; title:string; objective:string; roomId:string; minRelationship:number; actionPrompt:string; }
export interface StoryState { chapter:number; title:string; objective:string; roomId:string; relationshipLevel:number; actionPrompt:string; completedObjectives:string[]; flags:string[]; }
export const storyChapters:StoryChapter[]=[
 {chapter:1,title:'First Meeting',objective:'Break the ice',roomId:'studio',minRelationship:0,actionPrompt:'first encounter'},
 {chapter:2,title:'Private Space',objective:'Build trust',roomId:'penthouse',minRelationship:1,actionPrompt:'comfortable conversation'},
 {chapter:3,title:'Nightlife',objective:'Share a night out',roomId:'club',minRelationship:2,actionPrompt:'playful energy'},
 {chapter:4,title:'New Horizons',objective:'Plan the next scene',roomId:'outdoor',minRelationship:3,actionPrompt:'confident cinematic moment'}
];
export function storyForLevel(level:number):StoryChapter{return [...storyChapters].reverse().find(c=>level>=c.minRelationship)??storyChapters[0]}
export function initialStory(level:number):StoryState{const c=storyForLevel(level);return {...c,relationshipLevel:level,completedObjectives:[],flags:[]}}
export function advanceStory(state:StoryState,level:number):StoryState{const next=storyForLevel(level);if(next.chapter<=state.chapter)return {...state,relationshipLevel:level};return {...next,relationshipLevel:level,completedObjectives:[...state.completedObjectives,state.objective],flags:state.flags||[]}}
export function storyPrompt(state:StoryState):string{return `Story chapter ${state.chapter}: ${state.title}. Objective: ${state.objective}. Direction: ${state.actionPrompt}.`}
