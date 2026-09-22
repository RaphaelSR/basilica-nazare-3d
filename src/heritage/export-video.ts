import * as THREE from "three";
import {
  BufferTarget,
  CanvasSource,
  getFirstEncodableVideoCodec,
  Mp4OutputFormat,
  Output,
  Quality,
  type VideoCodec,
} from "mediabunny";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const width = 1080;
const height = 1920;
const frameSize = 1080;
const frameRate = 30;
const duration = 14;
const stageEnds = [.1, .14, .4, .5, .64, .86, .995, 1] as const;
const buildProgress = { value: 0 };

function copyAnimatedMaterial(material: THREE.Material) {
  const copy = material.clone();
  copy.onBeforeCompile = (shader) => {
    shader.uniforms.uBuildProgress = buildProgress;
    shader.vertexShader = "attribute vec3 aBuild; uniform float uBuildProgress; varying float vConstruction;\n" + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      float buildT=clamp((uBuildProgress-aBuild.x)/max(.0001,aBuild.y),0.0,1.0);
      vConstruction=buildT;
      float settle=sin(buildT*6.2831853)*pow(1.0-buildT,2.0)*0.035;
      transformed.y+=aBuild.z*(pow(1.0-buildT,3.0)-settle);`);
    shader.fragmentShader = "varying float vConstruction;\n" + shader.fragmentShader.replace("void main() {", "void main() { if(vConstruction<=0.0) discard;");
  };
  copy.customProgramCacheKey = () => "heritage-solid-assembly-v2";
  return copy;
}

export type VideoCopy = {
  brand: string;
  title: string;
  subtitle: string;
  stages: readonly string[];
};

export async function exportVerticalVideo(sourceScene: THREE.Scene, copy: VideoCopy, onProgress: (progress: number) => void) {
  const format = new Mp4OutputFormat();
  const codecs = format.getSupportedCodecs().filter((codec) => codec !== "aac" && codec !== "mp3") as VideoCodec[];
  const codec = await getFirstEncodableVideoCodec(codecs, { width, height });
  if (!codec) throw new Error("H.264 video encoding is unavailable in this browser.");

  const target = new BufferTarget();
  const output = new Output({ format, target });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable in this browser.");

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(1);
  renderer.setSize(frameSize, frameSize, false);
  renderer.setClearColor(0xf4f1e9, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = sourceScene.clone(true);
  const captureMaterials: THREE.Material[] = [];
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const copies = materials.map((material) => {
      const materialCopy = copyAnimatedMaterial(material);
      captureMaterials.push(materialCopy);
      return materialCopy;
    });
    object.material = Array.isArray(object.material) ? copies : copies[0];
    if (object.customDepthMaterial) {
      const depthCopy = copyAnimatedMaterial(object.customDepthMaterial);
      captureMaterials.push(depthCopy);
      object.customDepthMaterial = depthCopy as THREE.MeshDepthMaterial;
    }
  });
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 260);
  camera.position.set(65, 45, 82);
  camera.lookAt(0, 17, 0);

  const room = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room, .035);
  scene.environment = environment.texture;
  scene.environmentIntensity = .32;
  room.dispose();
  pmrem.dispose();

  scene.traverse((object) => {
    if (object instanceof THREE.DirectionalLight && object.castShadow) object.shadow.mapSize.set(2048, 2048);
  });

  const videoSource = new CanvasSource(canvas, { codec, quality: new Quality("high"), keyFrameInterval: 2 });
  output.addVideoTrack(videoSource);
  output.setMetadataTags({ title: copy.title, artist: "Basílica de Nazaré · Construção 3D" });

  try {
    await output.start();
    const totalFrames = duration * frameRate;
    for (let frame = 0; frame < totalFrames; frame++) {
      const progress = frame / (totalFrames - 1);
      buildProgress.value = progress;
      renderer.render(scene, camera);

      context.fillStyle = "#f4f1e9";
      context.fillRect(0, 0, width, height);
      context.fillStyle = "#924c3a";
      context.font = "500 28px Arial, sans-serif";
      context.letterSpacing = "5px";
      context.fillText(copy.brand.toLocaleUpperCase(), 78, 108);
      context.fillStyle = "#423e33";
      context.font = "400 66px Georgia, serif";
      context.letterSpacing = "0px";
      context.fillText(copy.title, 78, 222, width - 156);
      context.fillStyle = "#898171";
      context.font = "400 30px Georgia, serif";
      context.fillText(copy.subtitle, 80, 274, width - 160);

      context.drawImage(renderer.domElement, 0, 330, frameSize, frameSize);

      const stageIndex = stageEnds.findIndex((end) => progress < end);
      const stage = copy.stages[stageIndex === -1 ? copy.stages.length - 1 : stageIndex];
      context.fillStyle = "#423e33";
      context.font = "500 25px Arial, sans-serif";
      context.letterSpacing = "2px";
      context.fillText(stage.toLocaleUpperCase(), 80, 1535, width - 160);
      context.fillStyle = "rgba(66,62,51,.15)";
      context.fillRect(80, 1590, width - 160, 4);
      context.fillStyle = "#924c3a";
      context.fillRect(80, 1590, (width - 160) * progress, 4);
      context.fillStyle = "#898171";
      context.font = "500 24px Arial, sans-serif";
      context.letterSpacing = "3px";
      context.fillText("BELÉM · PARÁ", 80, 1690);
      context.textAlign = "right";
      context.fillText("BASÍLICA DE NAZARÉ", width - 80, 1690);
      context.textAlign = "left";
      context.strokeStyle = "rgba(76,65,43,.16)";
      context.beginPath();
      context.moveTo(80, 1740);
      context.lineTo(width - 80, 1740);
      context.stroke();
      context.fillStyle = "#898171";
      context.font = "400 23px Georgia, serif";
      context.letterSpacing = "0px";
      context.fillText(copy.subtitle.toLocaleUpperCase(), 80, 1800, width - 160);

      await videoSource.add(frame / frameRate, 1 / frameRate);
      if (frame % 6 === 0 || frame === totalFrames - 1) {
        onProgress((frame + 1) / totalFrames);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
    }
    await output.finalize();
    if (!target.buffer) throw new Error("The MP4 file was not created.");
    return new Blob([target.buffer], { type: format.mimeType });
  } catch (error) {
    if (output.state === "started") await output.cancel();
    throw error;
  } finally {
    captureMaterials.forEach((material) => material.dispose());
    environment.dispose();
    scene.traverse((object) => {
      if (object instanceof THREE.DirectionalLight && object.castShadow) object.shadow.map?.dispose();
    });
    renderer.dispose();
  }
}
