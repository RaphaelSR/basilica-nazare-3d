import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { createHeritageMaterials } from "./heritage/materials";
import { HeritageBuilder } from "./heritage/builder";
import { buildArchitecture, courtyard } from "./heritage/architecture";
import type { VideoCopy } from "./heritage/export-video";

export type DetailView="overview"|"towers"|"portico"|"rear";
type VideoExporter=(copy:VideoCopy,onProgress:(progress:number)=>void,night:boolean)=>Promise<Blob>;
type Props={progress:number;view?:DetailView;night?:boolean;onReady?:()=>void;label?:string;onVideoExportReady?:(exporter:VideoExporter)=>void};

export default function BasilicaScene({progress,view="overview",night=false,onReady,label="Animação 3D orbitável da construção da Basílica de Nazaré",onVideoExportReady}:Props){
  const mountRef=useRef<HTMLDivElement>(null);
  const progressRef=useRef(progress),viewRef=useRef(view),nightRef=useRef(night),readyRef=useRef(onReady);
  const exportReadyRef=useRef(onVideoExportReady);
  useEffect(()=>{progressRef.current=progress;},[progress]);
  useEffect(()=>{viewRef.current=view;},[view]);
  useEffect(()=>{nightRef.current=night;},[night]);
  useEffect(()=>{readyRef.current=onReady;},[onReady]);
  useEffect(()=>{exportReadyRef.current=onVideoExportReady;},[onVideoExportReady]);
  useEffect(()=>{
    const mount=mountRef.current;if(!mount)return;
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(34,1,.1,260);
    camera.position.set(59,34,70);
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:"high-performance"});
    renderer.setPixelRatio(Math.min(devicePixelRatio,window.innerWidth<700?1.5:2));
    renderer.setClearColor(0xf4f1e9,0);
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
    // Camera movement does not change a directional light's shadow map.
    renderer.shadowMap.autoUpdate=false;
    mount.appendChild(renderer.domElement);
    const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);
    const environment=pmrem.fromScene(room,.035);scene.environment=environment.texture;scene.environmentIntensity=.32;
    room.dispose();pmrem.dispose();
    const hemisphere=new THREE.HemisphereLight(0xfaf7ef,0x706a5c,.72);scene.add(hemisphere);
    // Equatorial afternoon sun from the south-west lights the facade and the right flank.
    const key=new THREE.DirectionalLight(0xfff2e2,2.4);key.name="day-key";key.position.set(-34,58,46);key.castShadow=true;
    key.shadow.mapSize.set(4096,4096);key.shadow.camera.left=-40;key.shadow.camera.right=40;
    key.shadow.camera.top=48;key.shadow.camera.bottom=-46;key.shadow.camera.near=.5;key.shadow.camera.far=170;
    key.target.position.set(0,12,0);key.shadow.normalBias=.025;key.shadow.bias=-.00015;key.shadow.radius=3;
    scene.add(key,key.target);
    const fill=new THREE.DirectionalLight(0xe5eced,.55);fill.name="day-fill";fill.position.set(40,22,-20);scene.add(fill);
    const rim=new THREE.DirectionalLight(0xfff4de,.7);rim.name="day-rim";rim.position.set(-18,36,-40);scene.add(rim);
    const facadeLights:[[number,number,number],number,number][]=[
      [[-8.6,27,24],32,15],[[8.6,27,24],32,15],
      [[-3.8,13.5,25],20,12],[[0,7,25],18,11],[[3.8,13.5,25],20,12],
      [[-7.8,5,24],12,9],[[7.8,5,24],12,9],[[0,17,24],12,10],
    ];
    for(const side of [-1,1])for(const z of [10,-1,-13])facadeLights.push([[side*12,5.6,z],16,13]);
    const warmLights=facadeLights.map(([position,intensity,distance])=>{
      const light=new THREE.PointLight(0xffa83f,0,distance,2);light.name="night-building";light.userData.nightIntensity=intensity;light.position.set(...position);scene.add(light);return{light,intensity};
    });
    const controls=new OrbitControls(camera,renderer.domElement);
    controls.target.set(0,14,0);controls.enableDamping=true;controls.dampingFactor=.075;
    controls.enablePan=true;controls.minDistance=10;controls.maxDistance=150;
    controls.minPolarAngle=.3;controls.maxPolarAngle=Math.PI*.51;
    const materialKit=createHeritageMaterials(renderer),builder=new HeritageBuilder(materialKit.materials);
    const glass=materialKit.materials.glass;
    const stainedGlass=materialKit.materials.stainedGlass;
    courtyard(builder);buildArchitecture(builder);builder.finish(scene);
    const reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const presets={
      overview:{position:new THREE.Vector3(59,34,70),target:new THREE.Vector3(0,14,0)},
      towers:{position:new THREE.Vector3(23.5,36,45),target:new THREE.Vector3(8.95,29.5,19.6)},
      portico:{position:new THREE.Vector3(7.5,14,61),target:new THREE.Vector3(0,11.6,21)},
      rear:{position:new THREE.Vector3(26,30,-53),target:new THREE.Vector3(0,10.5,-18.8)},
    };
    let lastView:DetailView="overview",transition=false,raf=0,lastNow=performance.now(),frames=0,elapsed=0,nightMix=0;
    let needsFrame=true,lastProgress=-2,lastShadowProgress=-2,lastShadowTime=-Infinity;
    let renderedFrames=0,shadowUpdates=0;
    const interrupt=()=>{transition=false;};controls.addEventListener("start",interrupt);
    const resize=()=>{
      const w=Math.max(1,mount.clientWidth),h=Math.max(1,mount.clientHeight);
      renderer.setSize(w,h,false);camera.aspect=w/h;
      camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(34)/2)*Math.max(1,1.2/camera.aspect)));
      camera.updateProjectionMatrix();
      needsFrame=true;
    };
    const ro=new ResizeObserver(resize);ro.observe(mount);resize();
    builder.progress.value=progressRef.current;
    renderer.compile(scene,camera);
    const render=(now:number)=>{
      const frameSeconds=(now-lastNow)/1000;
      const dt=Math.min(frameSeconds,.1);lastNow=now;
      const nightTarget=nightRef.current?1:0;
      nightMix=THREE.MathUtils.damp(nightMix,nightTarget,3.2,dt);
      if(Math.abs(nightMix-nightTarget)<.001)nightMix=nightTarget;
      const themeChanged=Math.abs(nightMix-nightTarget)>.001;
      hemisphere.intensity=THREE.MathUtils.lerp(.72,.24,nightMix);
      key.intensity=THREE.MathUtils.lerp(2.4,.42,nightMix);
      key.color.copy(new THREE.Color(0xfff2e2).lerp(new THREE.Color(0xa8c6f2),nightMix));
      fill.intensity=THREE.MathUtils.lerp(.55,.2,nightMix);fill.color.copy(new THREE.Color(0xe5eced).lerp(new THREE.Color(0x829bc5),nightMix));
      rim.intensity=THREE.MathUtils.lerp(.7,.16,nightMix);rim.color.copy(new THREE.Color(0xfff4de).lerp(new THREE.Color(0x536b9e),nightMix));
      warmLights.forEach(({light,intensity})=>{light.intensity=intensity*nightMix;});
      glass.emissive.set(0xffa83f);glass.emissiveIntensity=nightMix*1.65;
      glass.opacity=THREE.MathUtils.lerp(.12,.58,nightMix);
      stainedGlass.emissiveIntensity=nightMix*.75;
      scene.environmentIntensity=THREE.MathUtils.lerp(.32,.13,nightMix);
      renderer.toneMappingExposure=THREE.MathUtils.lerp(1,.72,nightMix);
      builder.progress.value=progressRef.current;
      if(lastView!==viewRef.current){lastView=viewRef.current;transition=true;}
      if(transition){
        const preset=presets[lastView],amount=reducedMotion?1:1-Math.exp(-dt*5);
        camera.position.lerp(preset.position,amount);controls.target.lerp(preset.target,amount);
        if(camera.position.distanceTo(preset.position)<.02){camera.position.copy(preset.position);controls.target.copy(preset.target);transition=false;}
      }
      const cameraChanged=controls.update();
      const progressChanged=lastProgress!==progressRef.current;
      // Limit construction shadow work to 30 Hz. Final/rewound poses flush
      // immediately, and a paused intermediate pose flushes on the next tick.
      const shadowChanged=lastShadowProgress!==progressRef.current &&
        (now-lastShadowTime>=1000/30 || progressRef.current===0 || progressRef.current===1);
      if(!document.hidden && (needsFrame || cameraChanged || transition || progressChanged || shadowChanged || themeChanged)){
        if(shadowChanged){
          renderer.shadowMap.needsUpdate=true;
          lastShadowProgress=progressRef.current;lastShadowTime=now;shadowUpdates++;
        }
        renderer.render(scene,camera);renderedFrames++;
        needsFrame=false;lastProgress=progressRef.current;
      }
      frames++;elapsed+=frameSeconds;
      if(elapsed>.6){
        mount.dataset.renderStats=JSON.stringify({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,pieces:builder.pieces,fps:Math.round(frames/elapsed),renderFps:Math.round(renderedFrames/elapsed),shadowUpdatesPerSecond:Math.round(shadowUpdates/elapsed),idle:renderedFrames===0,dpr:renderer.getPixelRatio(),shadowLights:1,postPasses:0});
        frames=0;elapsed=0;renderedFrames=0;shadowUpdates=0;
      }
      raf=requestAnimationFrame(render);
    };
    raf=requestAnimationFrame(render);readyRef.current?.();
    exportReadyRef.current?.(async(copy,onProgress,nightMode)=>{
      const {exportVerticalVideo}=await import("./heritage/export-video");
      return exportVerticalVideo(scene,copy,onProgress,nightMode);
    });
    return()=>{
      cancelAnimationFrame(raf);ro.disconnect();controls.removeEventListener("start",interrupt);controls.dispose();
      builder.dispose();materialKit.dispose();environment.dispose();
      key.shadow.map?.dispose();renderer.dispose();renderer.domElement.remove();
    };
  },[]);
  return <div ref={mountRef} className="three-scene" aria-label={label} />;
}
