import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { SurfaceName } from "./materials";

export type Point = [number, number, number];
type Transform = { p?: Point; r?: Point; s?: Point; shade?: number; tint?: Point; duration?: number; lift?: number };

/** Batch by material, with construction timing baked into each vertex.
 * Each real brick/beam/tile moves on the GPU; shadows use the same motion.
 * Construction changes no opacity, so walls remain solid and occlude framing.
 */
export class HeritageBuilder {
  private batches = new Map<SurfaceName, THREE.BufferGeometry[]>();
  private cache = new Map<string, THREE.BufferGeometry>();
  private transform = new THREE.Object3D();
  readonly progress = {value:0};
  readonly meshes: THREE.Mesh[] = [];
  private depths: THREE.MeshDepthMaterial[] = [];
  pieces = 0;
  constructor(readonly materials: Record<SurfaceName,THREE.MeshStandardMaterial>) {}

  add(geometry:THREE.BufferGeometry,material:SurfaceName,start:number,options:Transform={}) {
    this.transform.position.set(...(options.p??[0,0,0]));
    this.transform.rotation.set(...(options.r??[0,0,0]));
    this.transform.scale.set(...(options.s??[1,1,1]));
    this.transform.updateMatrix();
    const g=geometry.index?geometry.toNonIndexed():geometry.clone();
    g.applyMatrix4(this.transform.matrix);
    const n=g.getAttribute("position").count;
    const schedule=new Float32Array(n*3),color=new Float32Array(n*3);
    const shade=options.shade??1,tint=options.tint??[1,1,1];
    // Per-piece atlas offsets remove identical grain on repeated masonry/wood.
    const uv=g.getAttribute("uv");
    if(uv && material==="marble"){
      const pos=g.getAttribute("position"),normal=g.getAttribute("normal");
      for(let i=0;i<uv.count;i++){
        const nx=Math.abs(normal.getX(i)),ny=Math.abs(normal.getY(i)),nz=Math.abs(normal.getZ(i));
        uv.setXY(i,(nx>nz?pos.getZ(i):pos.getX(i))/5.5,(ny>.8?pos.getZ(i):pos.getY(i))/5.5);
      }
    }else if(uv && material!=="glass" && material!=="stainedGlass"){
      const offset=(Math.sin(this.pieces*127.1)*43758.5453)%1;
      for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)+offset,uv.getY(i)+offset*.731);
    }
    for(let i=0;i<n;i++){
      schedule.set([start,options.duration??.013,options.lift??.45],i*3);
      const normal=g.getAttribute("normal");
      const underside=normal?THREE.MathUtils.lerp(.76,1,THREE.MathUtils.smoothstep(normal.getY(i),-.8,.2)):1;
      color.set(tint.map(v=>v*shade*underside),i*3);
    }
    g.setAttribute("aBuild",new THREE.BufferAttribute(schedule,3));
    g.setAttribute("color",new THREE.BufferAttribute(color,3));
    if(!g.getAttribute("uv"))g.setAttribute("uv",new THREE.BufferAttribute(new Float32Array(n*2),2));
    if(!g.getAttribute("normal"))g.computeVertexNormals();
    for(const name of Object.keys(g.attributes))if(!["position","normal","uv","aBuild","color"].includes(name))g.deleteAttribute(name);
    if(!this.batches.has(material))this.batches.set(material,[]);
    this.batches.get(material)!.push(g); this.pieces++;
  }
  geo(key:string,fn:()=>THREE.BufferGeometry){if(!this.cache.has(key))this.cache.set(key,fn());return this.cache.get(key)!;}
  box(size:Point,p:Point,material:SurfaceName,start:number,options:Transform={}) {
    const key=`box:${size.join(",")}`;
    const geometry=this.geo(key,()=>{
      if(Math.min(...size)<.18)return new THREE.BoxGeometry(...size);
      const [w,h,d]=size,r=Math.min(...size)*.055;
      const outline=new THREE.Shape();
      outline.moveTo(-w/2+r,-h/2+r);outline.lineTo(w/2-r,-h/2+r);
      outline.lineTo(w/2-r,h/2-r);outline.lineTo(-w/2+r,h/2-r);outline.closePath();
      const g=new THREE.ExtrudeGeometry(outline,{depth:d-2*r,bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:1,steps:1});
      g.translate(0,0,-d/2+r);return g;
    });
    this.add(geometry,material,start,{...options,p});
  }
  masonry(size:Point,p:Point,material:SurfaceName,start:number,options:Transform={}){
    // Chamfer the exposed face; the sealed flat back keeps each block at 20 triangles.
    const geometry=this.geo(`masonry:${size.join(",")}`,()=>{
      const [w,h,d]=size,r=Math.min(...size)*.055,vertices:number[]=[],positions:number[]=[],uv:number[]=[];
      for(const [inset,z]of[[0,-d/2],[0,d/2-r],[r,d/2]])
        for(const [x,y]of[[-1,-1],[1,-1],[1,1],[-1,1]])vertices.push(x*(w/2-inset),y*(h/2-inset),z);
      const face=(a:number,b:number,c:number,e:number)=>{
        for(const [i,u,v]of[[a,0,0],[b,1,0],[c,1,1],[a,0,0],[c,1,1],[e,0,1]]){
          positions.push(...vertices.slice(i*3,i*3+3));uv.push(u,v);
        }
      };
      face(3,2,1,0);face(8,9,10,11);
      for(let ring=0;ring<2;ring++)for(let i=0;i<4;i++)face(ring*4+i,ring*4+(i+1)%4,(ring+1)*4+(i+1)%4,(ring+1)*4+i);
      const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
      g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
    });
    this.add(geometry,material,start,{...options,p});
  }
  sphere(p:Point,s:Point,material:SurfaceName,start:number,options:Transform={}){
    const detail=Math.max(...s)>.3;
    this.add(this.geo(`sphere:${detail}`,()=>new THREE.SphereGeometry(1,detail?16:10,detail?12:7)),material,start,{...options,p,s});
  }
  cylinder(top:number,bottom:number,height:number,p:Point,material:SurfaceName,start:number,options:Transform={}){
    this.add(this.geo(`cyl:${top}/${bottom}/${height}`,()=>new THREE.CylinderGeometry(top,bottom,height,12)),material,start,{...options,p});
  }
  tube(points:Point[],radius:number,material:SurfaceName,start:number,options:Transform={},segments=18){
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    const geometry=new THREE.TubeGeometry(curve,segments,radius,5,false);
    this.add(geometry,material,start,options);geometry.dispose();
  }
  finish(scene:THREE.Scene){
    const inject=(m:THREE.Material)=>{
      m.onBeforeCompile=shader=>{
        shader.uniforms.uBuildProgress=this.progress;
        shader.vertexShader="attribute vec3 aBuild; uniform float uBuildProgress; varying float vConstruction;\n"+shader.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>
          float buildT=clamp((uBuildProgress-aBuild.x)/max(.0001,aBuild.y),0.0,1.0);
          vConstruction=buildT;
          float settle=sin(buildT*6.2831853)*pow(1.0-buildT,2.0)*0.035;
          transformed.y+=aBuild.z*(pow(1.0-buildT,3.0)-settle);`);
        shader.fragmentShader="varying float vConstruction;\n"+shader.fragmentShader.replace("void main() {","void main() { if(vConstruction<=0.0) discard;");
      };
      m.customProgramCacheKey=()=>"heritage-solid-assembly-v2";
    };
    for(const [name,geometries]of this.batches){
      const combined=mergeGeometries(geometries,false)!;
      combined.computeBoundingSphere();geometries.forEach(g=>g.dispose());
      const material=this.materials[name];inject(material);
      const mesh=new THREE.Mesh(combined,material);
      mesh.name=`heritage-${name}`;mesh.receiveShadow=name!=="glass";mesh.castShadow=!["moss","glass"].includes(name);
      const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});inject(depth);
      mesh.customDepthMaterial=depth;this.depths.push(depth);this.meshes.push(mesh);scene.add(mesh);
    }
    this.cache.forEach(g=>g.dispose());this.cache.clear();this.batches.clear();
  }
  dispose(){this.meshes.forEach(m=>{m.geometry.dispose();m.removeFromParent();});this.depths.forEach(m=>m.dispose());}
}
