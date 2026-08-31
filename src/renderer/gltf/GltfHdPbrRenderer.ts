import { GltfAvatar, GltfAvatarPrimitive, gltfLocalMatrix, loadGltfAvatar, updateGltfJointMatrices } from './GltfAvatar';
import { drawGltfPrimitive } from './GltfMesh';
import { mat4LookAt, mat4Perspective } from '../math';

const VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUV;
layout(location=3) in uvec4 aJoints;
layout(location=4) in vec4 aWeights;
uniform mat4 uModel,uView,uProjection;
uniform mat4 uBones[128];
uniform int uSkinOffset;
uniform bool uSkinned;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vUV;
void main(){
  mat4 skin=mat4(1.0);
  if(uSkinned){
    skin=uBones[uSkinOffset+int(aJoints.x)]*aWeights.x+uBones[uSkinOffset+int(aJoints.y)]*aWeights.y+uBones[uSkinOffset+int(aJoints.z)]*aWeights.z+uBones[uSkinOffset+int(aJoints.w)]*aWeights.w;
  }
  vec4 p=uModel*skin*vec4(aPosition,1.0);
  vWorld=p.xyz;
  vNormal=normalize(mat3(uModel*skin)*aNormal);
  vUV=aUV;
  gl_Position=uProjection*uView*p;
}`;

const FS = `#version 300 es
precision highp float;
in vec3 vWorld;
in vec3 vNormal;
in vec2 vUV;
layout(location=0) out vec4 outColor;
uniform sampler2D uBaseColor;
uniform sampler2D uMetallicRoughness;
uniform sampler2D uNormal;
uniform sampler2D uOcclusion;
uniform vec4 uBaseFactor;
uniform vec3 uEmissive;
uniform float uMetallic;
uniform float uRoughness;
uniform float uNormalScale;
uniform float uOcclusionStrength;
uniform vec3 uCamera;
uniform vec3 uLightPosition;
uniform vec3 uLightColor;
uniform vec3 uAmbient;
uniform float uExposure;
uniform bool uHasBase;
uniform bool uHasMR;
uniform bool uHasNormal;
uniform bool uHasOcclusion;
const float PI=3.14159265359;
vec3 aces(vec3 x){return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);}
vec3 fresnel(float c,vec3 f0){return f0+(1.0-f0)*pow(1.0-c,5.0);}
void main(){
  vec4 base=uBaseFactor;
  if(uHasBase) base*=texture(uBaseColor,vUV);
  float metallic=uMetallic;
  float rough=max(0.04,uRoughness);
  if(uHasMR){vec4 mr=texture(uMetallicRoughness,vUV); metallic*=mr.b; rough*=mr.g;}
  vec3 N=normalize(vNormal);
  if(uHasNormal){
    vec3 map=texture(uNormal,vUV).xyz*2.0-1.0;
    vec3 dp1=dFdx(vWorld),dp2=dFdy(vWorld),duv1=dFdx(vUV),duv2=dFdy(vUV);
    vec3 T=normalize(dp1*duv2.y-dp2*duv1.y);
    vec3 B=normalize(cross(N,T));
    N=normalize(mat3(T,B,N)*vec3(map.xy*uNormalScale,map.z));
  }
  vec3 V=normalize(uCamera-vWorld),L=normalize(uLightPosition-vWorld),H=normalize(V+L);
  float ndl=max(dot(N,L),0.0),ndv=max(dot(N,V),0.0),ndh=max(dot(N,H),0.0);
  float a=rough*rough,a2=a*a,d=max(PI*pow(ndh*ndh*(a2-1.0)+1.0,2.0),0.0001);
  float D=a2/d;
  float k=(rough+1.0); k=k*k/8.0;
  float G=(ndv/(ndv*(1.0-k)+k))*(ndl/(ndl*(1.0-k)+k));
  vec3 f0=mix(vec3(0.04),base.rgb,metallic);
  vec3 F=fresnel(max(dot(H,V),0.0),f0);
  vec3 spec=D*G*F/max(4.0*ndv*ndl,0.001);
  vec3 kd=(1.0-F)*(1.0-metallic);
  float dist=max(length(uLightPosition-vWorld),0.01);
  vec3 direct=(kd*base.rgb/PI+spec)*uLightColor*(12.0/(dist*dist))*ndl;
  vec3 ambient=uAmbient*base.rgb*0.55;
  if(uHasOcclusion){float ao=texture(uOcclusion,vUV).r; ambient*=mix(1.0,ao,uOcclusionStrength);}
  vec3 color=(ambient+direct+uEmissive)*uExposure;
  color=aces(1.0-exp(-color));
  outColor=vec4(pow(max(color,0.0),vec3(1.0/2.2)),base.a);
}`;

function shader(gl: WebGL2RenderingContext,type:number,src:string):WebGLShader{
  const s=gl.createShader(type); if(!s) throw new Error('GL shader allocation failed');
  gl.shaderSource(s,src); gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)??'GL shader compile failed');
  return s;
}
function program(gl:WebGL2RenderingContext):WebGLProgram{
  const p=gl.createProgram(); if(!p) throw new Error('GL program allocation failed');
  const v=shader(gl,gl.VERTEX_SHADER,VS),f=shader(gl,gl.FRAGMENT_SHADER,FS);
  gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.deleteShader(v);gl.deleteShader(f);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)??'GL program link failed');
  return p;
}

function multiply(a: Float32Array,b: Float32Array): Float32Array {
  const out=new Float32Array(16);
  for(let c=0;c<4;c++) for(let r=0;r<4;r++) out[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
  return out;
}

export interface GltfHdPbrRendererOptions { exposure?:number; }

export class GltfHdPbrRenderer {
  private readonly gl:WebGL2RenderingContext;
  private readonly program:WebGLProgram;
  private avatar:GltfAvatar|null=null;
  private exposure:number;
  constructor(gl:WebGL2RenderingContext, options:GltfHdPbrRendererOptions={}){this.gl=gl;this.exposure=options.exposure??1;this.program=program(gl);}
  async load(data:ArrayBuffer):Promise<void>{this.avatar?.destroy();this.avatar=await loadGltfAvatar(this.gl,data);}
  setExposure(value:number):void{this.exposure=Math.max(0.1,Math.min(8,value));}
  get loaded():boolean{return this.avatar!==null;}
  get primitiveCount():number{return this.avatar?.primitives.length??0;}
  get skinCount():number{return this.avatar?.skins.length??0;}
  get morphTargetCount():number{return this.avatar?.primitives.reduce((n,p)=>n+p.primitive.morphTargets.length,0)??0;}
  private nodeWorld(primitive:GltfAvatarPrimitive):Float32Array {
    const nodes=this.avatar!.nodes, world:Array<Float32Array|undefined>=new Array(nodes.length), resolving=new Set<number>();
    const resolve=(index:number):Float32Array=>{
      if(world[index]) return world[index]!;
      if(resolving.has(index)) throw new Error(`glTF node cycle at ${index}`);
      const node=nodes[index]; if(!node) throw new Error(`Missing glTF node ${index}`);
      resolving.add(index);
      const parent=nodes.findIndex(n=>n.children?.includes(index));
      const local=gltfLocalMatrix(node);
      world[index]=parent>=0?multiply(resolve(parent),local):local;
      resolving.delete(index); return world[index]!;
    };
    return resolve(primitive.nodeIndex);
  }
  render(width=this.gl.drawingBufferWidth,height=this.gl.drawingBufferHeight):void{
    const gl=this.gl;if(!this.avatar) return;
    updateGltfJointMatrices(this.avatar);
    const aspect=Math.max(width,1)/Math.max(height,1);
    const view=mat4LookAt([0,1.55,4.2],[0,1.45,0],[0,1,0]);
    const projection=mat4Perspective(45*Math.PI/180,aspect,0.01,100);
    gl.viewport(0,0,width,height);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.program,'uView'),false,view);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.program,'uProjection'),false,projection);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.program,'uBones'),false,this.avatar.jointMatrices);
    gl.uniform3f(gl.getUniformLocation(this.program,'uCamera'),0,1.55,4.2);
    gl.uniform3f(gl.getUniformLocation(this.program,'uLightPosition'),2.5,4.5,3.5);
    gl.uniform3f(gl.getUniformLocation(this.program,'uLightColor'),1,0.92,0.82);
    gl.uniform3f(gl.getUniformLocation(this.program,'uAmbient'),0.16,0.18,0.22);
    gl.uniform1f(gl.getUniformLocation(this.program,'uExposure'),this.exposure);
    for(const item of this.avatar.primitives){
      const m=this.avatar.materials[item.primitive.materialIndex];
      const node=this.nodeWorld(item);
      const bind=(name:string,unit:number,index:number|null)=>{const tex=index===null?null:this.avatar?.textures.get(index);gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,tex??null);gl.uniform1i(gl.getUniformLocation(this.program,name),unit);return tex!==undefined&&tex!==null;};
      const hasBase=bind('uBaseColor',0,m?.baseColorTextureIndex??null),hasMR=bind('uMetallicRoughness',1,m?.metallicRoughnessTextureIndex??null),hasNormal=bind('uNormal',2,m?.normalTextureIndex??null),hasAo=bind('uOcclusion',3,m?.occlusionTextureIndex??null);
      gl.uniformMatrix4fv(gl.getUniformLocation(this.program,'uModel'),false,node);
      gl.uniform1i(gl.getUniformLocation(this.program,'uSkinned'),item.skinIndex===null?0:1);
      gl.uniform1i(gl.getUniformLocation(this.program,'uSkinOffset'),item.primitive.skinOffset);
      gl.uniform1i(gl.getUniformLocation(this.program,'uHasBase'),hasBase?1:0);gl.uniform1i(gl.getUniformLocation(this.program,'uHasMR'),hasMR?1:0);gl.uniform1i(gl.getUniformLocation(this.program,'uHasNormal'),hasNormal?1:0);gl.uniform1i(gl.getUniformLocation(this.program,'uHasOcclusion'),hasAo?1:0);
      gl.uniform4fv(gl.getUniformLocation(this.program,'uBaseFactor'),new Float32Array(m?.baseColorFactor??[1,1,1,1]));
      gl.uniform3fv(gl.getUniformLocation(this.program,'uEmissive'),new Float32Array(m?.emissiveFactor??[0,0,0]));
      gl.uniform1f(gl.getUniformLocation(this.program,'uMetallic'),m?.metallic??0);gl.uniform1f(gl.getUniformLocation(this.program,'uRoughness'),m?.roughness??0.5);gl.uniform1f(gl.getUniformLocation(this.program,'uNormalScale'),m?.normalScale??1);gl.uniform1f(gl.getUniformLocation(this.program,'uOcclusionStrength'),m?.occlusionStrength??1);
      drawGltfPrimitive(gl,item.primitive);
    }
    gl.bindTexture(gl.TEXTURE_2D,null);
  }
  destroy():void{this.avatar?.destroy();this.avatar=null;this.gl.deleteProgram(this.program);}
}
