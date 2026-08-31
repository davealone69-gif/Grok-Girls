import { GltfAvatar, updateGltfJointMatrices } from './GltfAvatar';
import { GltfMaterialBinding } from './GltfMaterial';
import { drawGltfPrimitive } from './GltfMesh';

const VS = `#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUV;
layout(location=3) in uvec4 aJoints;
layout(location=4) in vec4 aWeights;
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;
uniform mat4 uBones[128];
uniform int uSkinOffset;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vUV;
void main(){
  float weightSum = aWeights.x+aWeights.y+aWeights.z+aWeights.w;
  mat4 skin = mat4(1.0);
  if(weightSum > 0.0001){
    skin = uBones[uSkinOffset+int(aJoints.x)]*aWeights.x +
           uBones[uSkinOffset+int(aJoints.y)]*aWeights.y +
           uBones[uSkinOffset+int(aJoints.z)]*aWeights.z +
           uBones[uSkinOffset+int(aJoints.w)]*aWeights.w;
  }
  vec4 p = uModel*skin*vec4(aPosition,1.0);
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
uniform vec3 uCamera;
uniform vec3 uLightPosition;
uniform vec3 uLightColor;
uniform vec3 uAmbient;
uniform vec4 uBaseColorFactor;
uniform float uMetallic;
uniform float uRoughness;
uniform float uExposure;
uniform float uSubsurface;
uniform sampler2D uBaseColorMap;
uniform sampler2D uMetallicRoughnessMap;
uniform sampler2D uNormalMap;
uniform int uHasBaseColorMap;
uniform int uHasMetallicRoughnessMap;
uniform int uHasNormalMap;
const float PI=3.14159265359;
vec3 F(float c,vec3 f0){return f0+(1.0-f0)*pow(1.0-c,5.0);}
float D(vec3 n,vec3 h,float r){float a=r*r,a2=a*a,nh=max(dot(n,h),0.0),d=nh*nh*(a2-1.0)+1.0;return a2/max(PI*d*d,0.0001);}
float G1(float n,float r){float k=(r+1.0)*(r+1.0)/8.0;return n/(n*(1.0-k)+k);}
float G(vec3 n,vec3 v,vec3 l,float r){return G1(max(dot(n,v),0.0),r)*G1(max(dot(n,l),0.0),r);}
vec3 ACES(vec3 x){return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);}
void main(){
  vec4 tex= uHasBaseColorMap==1 ? texture(uBaseColorMap,vUV) : vec4(1.0);
  vec3 albedo=tex.rgb*uBaseColorFactor.rgb;
  float alpha=tex.a*uBaseColorFactor.a;
  if(alpha<0.003) discard;
  vec3 n=normalize(vNormal);
  if(uHasNormalMap==1){
    vec3 map=texture(uNormalMap,vUV).xyz*2.0-1.0;
    vec3 dp1=dFdx(vWorld),dp2=dFdy(vWorld),duv1=dFdx(vUV),duv2=dFdy(vUV);
    vec3 t=normalize(dp1*duv2.y-dp2*duv1.y);
    vec3 b=normalize(cross(n,t));
    n=normalize(mat3(t,b,n)*map);
  }
  float metallic=uMetallic, roughness=max(0.04,uRoughness);
  if(uHasMetallicRoughnessMap==1){vec4 mr=texture(uMetallicRoughnessMap,vUV);roughness=max(0.04,roughness*mr.g);metallic=clamp(metallic*mr.b,0.0,1.0);}
  vec3 v=normalize(uCamera-vWorld),l=normalize(uLightPosition-vWorld),h=normalize(v+l);
  float ndl=max(dot(n,l),0.0),ndv=max(dot(n,v),0.0);
  vec3 f0=mix(vec3(0.04),albedo,metallic), f=F(max(dot(h,v),0.0),f0);
  vec3 spec=D(n,h,roughness)*G(n,v,l,roughness)*f/max(4.0*ndv*ndl,0.001);
  vec3 kd=(vec3(1.0)-f)*(1.0-metallic);
  float dist=length(uLightPosition-vWorld),att=1.0/max(dist*dist,0.01);
  vec3 direct=(kd*albedo/PI+spec)*uLightColor*att*12.0*ndl;
  vec3 ambient=uAmbient*albedo*0.55;
  vec3 scatter=vec3(1.0,0.32,0.18)*pow(max(dot(-l,n),0.0),2.5)*uSubsurface;
  vec3 c=ambient+direct+scatter;
  c=vec3(1.0)-exp(-c*uExposure);
  outColor=vec4(pow(ACES(c),vec3(1.0/2.2)),alpha);
}`;

export interface GltfHdRenderOptions {
  model: Float32Array;
  view: Float32Array;
  projection: Float32Array;
  camera: [number,number,number];
  lightPosition?: [number,number,number];
  lightColor?: [number,number,number];
  ambient?: [number,number,number];
  exposure?: number;
  subsurface?: number;
}

export class GltfHdRenderPass {
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly locations: Record<string, WebGLUniformLocation | null>;

  constructor(gl: WebGL2RenderingContext){
    this.gl=gl;
    this.program=link(gl,VS,FS);
    this.locations={model:gl.getUniformLocation(this.program,'uModel'),view:gl.getUniformLocation(this.program,'uView'),projection:gl.getUniformLocation(this.program,'uProjection'),camera:gl.getUniformLocation(this.program,'uCamera'),lightPosition:gl.getUniformLocation(this.program,'uLightPosition'),lightColor:gl.getUniformLocation(this.program,'uLightColor'),ambient:gl.getUniformLocation(this.program,'uAmbient'),bones:gl.getUniformLocation(this.program,'uBones'),skinOffset:gl.getUniformLocation(this.program,'uSkinOffset'),baseColorFactor:gl.getUniformLocation(this.program,'uBaseColorFactor'),metallic:gl.getUniformLocation(this.program,'uMetallic'),roughness:gl.getUniformLocation(this.program,'uRoughness'),exposure:gl.getUniformLocation(this.program,'uExposure'),subsurface:gl.getUniformLocation(this.program,'uSubsurface'),baseColorMap:gl.getUniformLocation(this.program,'uBaseColorMap'),metallicRoughnessMap:gl.getUniformLocation(this.program,'uMetallicRoughnessMap'),normalMap:gl.getUniformLocation(this.program,'uNormalMap'),hasBaseColorMap:gl.getUniformLocation(this.program,'uHasBaseColorMap'),hasMetallicRoughnessMap:gl.getUniformLocation(this.program,'uHasMetallicRoughnessMap'),hasNormalMap:gl.getUniformLocation(this.program,'uHasNormalMap')};
  }

  render(avatar:GltfAvatar, options:GltfHdRenderOptions):number{
    const gl=this.gl;
    updateGltfJointMatrices(avatar);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.locations.model,false,options.model);
    gl.uniformMatrix4fv(this.locations.view,false,options.view);
    gl.uniformMatrix4fv(this.locations.projection,false,options.projection);
    gl.uniform3fv(this.locations.camera,new Float32Array(options.camera));
    gl.uniform3fv(this.locations.lightPosition,new Float32Array(options.lightPosition??[2.5,4.5,3.5]));
    gl.uniform3fv(this.locations.lightColor,new Float32Array(options.lightColor??[1,0.92,0.82]));
    gl.uniform3fv(this.locations.ambient,new Float32Array(options.ambient??[0.16,0.18,0.22]));
    gl.uniformMatrix4fv(this.locations.bones,false,avatar.jointMatrices);
    gl.uniform1f(this.locations.exposure,options.exposure??1);
    gl.uniform1f(this.locations.subsurface,options.subsurface??0.18);
    let draws=0;
    for(const item of avatar.primitives){
      const material: GltfMaterialBinding|undefined=avatar.materials[item.primitive.materialIndex];
      const baseFactor=material?.baseColorFactor??[1,1,1,1];
      gl.uniform4fv(this.locations.baseColorFactor,new Float32Array(baseFactor));
      gl.uniform1f(this.locations.metallic,material?.metallic??0);
      gl.uniform1f(this.locations.roughness,material?.roughness??0.5);
      gl.uniform1i(this.locations.skinOffset,item.primitive.skinOffset??0);
      bindTexture(gl,avatar.textures,material?.baseColorTextureIndex??null,0,this.locations.baseColorMap,this.locations.hasBaseColorMap);
      bindTexture(gl,avatar.textures,material?.metallicRoughnessTextureIndex??null,1,this.locations.metallicRoughnessMap,this.locations.hasMetallicRoughnessMap);
      bindTexture(gl,avatar.textures,material?.normalTextureIndex??null,2,this.locations.normalMap,this.locations.hasNormalMap);
      drawGltfPrimitive(gl,item.primitive);
      draws++;
    }
    return draws;
  }

  destroy():void{this.gl.deleteProgram(this.program);}
}

function bindTexture(gl:WebGL2RenderingContext,textures:Map<number,WebGLTexture>,index:number|null,unit:number,sampler:WebGLUniformLocation|null,has:WebGLUniformLocation|null){
  const texture=index===null?null:textures.get(index)??null;
  gl.activeTexture(gl.TEXTURE0+unit);
  gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.uniform1i(sampler,unit);
  gl.uniform1i(has,texture?1:0);
}
function compile(gl:WebGL2RenderingContext,type:number,source:string):WebGLShader{const shader=gl.createShader(type);if(!shader)throw new Error('Unable to create GLB shader');gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const log=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(`GLB shader compilation failed: ${log}`);}return shader;}
function link(gl:WebGL2RenderingContext,vs:string,fs:string):WebGLProgram{const vertex=compile(gl,gl.VERTEX_SHADER,vs),fragment=compile(gl,gl.FRAGMENT_SHADER,fs),program=gl.createProgram();if(!program)throw new Error('Unable to create GLB shader program');gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);if(!gl.getProgramParameter(program,gl.LINK_STATUS)){const log=gl.getProgramInfoLog(program);gl.deleteProgram(program);throw new Error(`GLB shader link failed: ${log}`);}return program;}
