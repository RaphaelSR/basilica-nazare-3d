import * as THREE from "three";

export type SurfaceName = "marble" | "stone" | "granite" | "tile" | "wood" | "gold" | "iron" | "recess" | "moss" | "glass";

// Deterministic multi-scale wear: the basilica should age in coherent patches
// (rain runs below cornices, warm clouding on plaster), not per-block confetti.
export function createHeritageMaterials(renderer: THREE.WebGLRenderer) {
  const textures: THREE.Texture[] = [];
  const palette: Record<SurfaceName, string> = {
    marble: "#e8e3d8", stone: "#858b84", granite: "#b9897c", tile: "#ab603e", wood: "#513724",
    gold: "#c6a34d", iron: "#3a3835", recess: "#2a2622", moss: "#4a6b3a", glass: "#b6c8c3",
  };
  const output = {} as Record<SurfaceName, THREE.MeshStandardMaterial>;
  for (const [name, base] of Object.entries(palette) as [SurfaceName, string][]) {
    if(name==="glass"){
      output[name]=new THREE.MeshPhysicalMaterial({color:base,roughness:.16,metalness:0,transparent:true,opacity:.12,depthWrite:false,clearcoat:.65,clearcoatRoughness:.18,vertexColors:true});
      continue;
    }
    const canvas = document.createElement("canvas");
    const size = 512;
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    let seed = 83 + name.length * 101;
    const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    // Mineral clouding and worn pigment, with transparent soft edges.
    for (let i = 0; i < 180; i++) {
      const x = rand() * size, y = rand() * size, r = size * (.02 + rand() * .13);
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      const dark = name === "tile" ? "rgba(70,30,18,.05)" : name === "marble" ? "rgba(120,110,90,.028)" : "rgba(45,34,19,.038)";
      const light = name === "tile" ? "rgba(240,170,120,.045)" : "rgba(252,244,217,.045)";
      gradient.addColorStop(0, i % 3 ? dark : light);
      gradient.addColorStop(1, "rgba(100,80,50,0)");
      ctx.fillStyle = gradient; ctx.fillRect(x-r, y-r, r*2, r*2);
    }
    if (name === "wood") {
      for (let i = 0; i < 290; i++) {
        const x = rand() * size;
        ctx.strokeStyle = i % 3 ? "rgba(30,19,10,.16)" : "rgba(223,184,127,.13)";
        ctx.lineWidth = .4 + rand() * 1.8;
        ctx.beginPath(); ctx.moveTo(x, 0);
        for (let y = 0; y <= size; y += 8) ctx.lineTo(x + Math.sin(y*.035 + x)*2 + Math.sin(y*.008)*5, y);
        ctx.stroke();
      }
    }
    if(name === "wood"){
      for(let k=0;k<4;k++){
        const x=70+rand()*370,y=rand()*size;
        for(let i=0;i<7;i++){
          ctx.strokeStyle=`rgba(26,16,9,${.12-i*.012})`;ctx.lineWidth=.8;
          ctx.beginPath();ctx.ellipse(x,y,2+i*2,5+i*6,.04,0,Math.PI*2);ctx.stroke();
        }
      }
    }
    if (name === "marble") {
      for(let i=0;i<11;i++){
        const x0=rand()*size*1.8-size*.4,phase=rand()*6;
        const vein=(offset:number)=>{
          ctx.beginPath();
          for(let y=-10;y<=size+10;y+=5){
            const x=x0+y*.46+Math.sin(y*.013+phase)*14+Math.sin(y*.051+phase)*3+offset;
            if(y===-10)ctx.moveTo(x,y);else ctx.lineTo(x,y);
          }
          ctx.stroke();
        };
        ctx.strokeStyle="rgba(128,126,114,.045)";ctx.lineWidth=7;vein(0);
        ctx.strokeStyle="rgba(116,115,106,.12)";ctx.lineWidth=.7;vein(0);
        ctx.strokeStyle="rgba(164,145,112,.055)";ctx.lineWidth=1.5;vein(2.5);
        const y=rand()*size,x=x0+y*.46+Math.sin(y*.013+phase)*14;
        ctx.strokeStyle="rgba(125,119,106,.075)";ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(x,y);
        ctx.bezierCurveTo(x-9,y+20,x+8,y+38,x-12,y+72);ctx.stroke();
      }
      for(let i=0;i<30;i++){
        const x=rand()*size,w=2+rand()*14,h=30+rand()*160;
        const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,"rgba(95,95,75,.10)");g.addColorStop(1,"rgba(95,95,75,0)");
        ctx.fillStyle=g;ctx.fillRect(x,0,w,h);
      }
    }
    if (name === "stone" || name === "granite") {
      // Granite: dense dark and pale flecks; the pink variety reads as polished columns.
      for (let i = 0; i < 9000; i++) { ctx.fillStyle = rand() > .65 ? "rgba(52,45,47,.28)" : "rgba(244,220,208,.25)"; const s = .5 + rand() * 2.2; ctx.fillRect(rand() * size, rand() * size, s, s); }
    }
    for(let i=0;i<17000;i++){
      ctx.globalAlpha=name==="tile"?.25:1;
      ctx.fillStyle=rand()>.45?`rgba(255,242,214,${.04+rand()*.13})`:`rgba(31,26,18,${.025+rand()*.1})`;
      const s=.4+rand()*1.6;ctx.fillRect(rand()*size,rand()*size,s,s);
    }
    ctx.globalAlpha=1;
    const texture=new THREE.CanvasTexture(canvas);
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    textures.push(texture);
    // Micro-height and roughness are independent of pigment: stains are not craters.
    const detail=document.createElement("canvas");detail.width=detail.height=256;
    const dc=detail.getContext("2d")!,pixels=dc.createImageData(256,256);
    for(let y=0;y<256;y++)for(let x=0;x<256;x++){
      const i=(y*256+x)*4;
      const grain=name==="wood"?Math.sin(x*.83+Math.sin(y*.033)*2)*20:0;
      const v=128+(rand()-.5)*(name==="stone"?65:name==="granite"?18:name==="marble"?22:32)+grain;
      pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=v;pixels.data[i+3]=255;
    }
    dc.putImageData(pixels,0,0);
    const bump=new THREE.CanvasTexture(detail);bump.wrapS=bump.wrapT=THREE.RepeatWrapping;bump.anisotropy=texture.anisotropy;textures.push(bump);
    const roughCanvas=document.createElement("canvas");roughCanvas.width=roughCanvas.height=256;
    const rc=roughCanvas.getContext("2d")!;rc.fillStyle=name==="tile"?"#b4b4b4":name==="wood"?"#d4d4d4":name==="gold"?"#8a8a8a":"#ededed";rc.fillRect(0,0,256,256);
    for(let i=0;i<90;i++){rc.fillStyle=`rgba(60,60,60,${.02+rand()*.045})`;rc.fillRect(rand()*256,rand()*256,8+rand()*35,8+rand()*35);}
    const roughness=new THREE.CanvasTexture(roughCanvas);roughness.wrapS=roughness.wrapT=THREE.RepeatWrapping;textures.push(roughness);
    const options:THREE.MeshStandardMaterialParameters={
      map:texture,bumpMap:bump,roughnessMap:roughness,
      bumpScale:name==="marble"?.006:name==="granite"?.008:name==="tile"?.01:.018,
      roughness:name==="gold"?.56:name==="granite"?.36:name==="marble"?.78:name==="iron"?.7:name==="tile"?.88:.9,
      metalness:name==="gold"?.68:name==="iron"?.4:0,vertexColors:true,
    };
    output[name]=name==="granite"
      ?new THREE.MeshPhysicalMaterial({...options,clearcoat:.38,clearcoatRoughness:.24})
      :new THREE.MeshStandardMaterial(options);
  }
  return {materials:output,dispose(){textures.forEach(t=>t.dispose());Object.values(output).forEach(m=>m.dispose());}};
}
