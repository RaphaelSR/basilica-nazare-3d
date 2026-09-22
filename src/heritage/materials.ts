import * as THREE from "three";

export type SurfaceName = "marble" | "stone" | "granite" | "tile" | "wood" | "gold" | "iron" | "recess" | "moss" | "glass" | "stainedGlass" | "ribbon" | "mosaic";

function stainedGlassTexture(){
  const canvas=document.createElement("canvas");canvas.width=256;canvas.height=512;
  const c=canvas.getContext("2d")!;
  const sky=c.createLinearGradient(0,0,0,512);sky.addColorStop(0,"#073b75");sky.addColorStop(.48,"#28a6cb");sky.addColorStop(1,"#174b81");
  c.fillStyle=sky;c.fillRect(0,0,256,512);
  c.fillStyle="#06334b";c.fillRect(0,0,20,512);c.fillRect(236,0,20,512);
  c.fillStyle="#dfa93f";c.fillRect(20,0,7,512);c.fillRect(229,0,7,512);
  c.fillStyle="#f2c75c";c.beginPath();c.arc(128,95,65,0,Math.PI*2);c.fill();
  c.fillStyle="#195e9b";c.beginPath();c.arc(128,95,53,0,Math.PI*2);c.fill();
  for(let i=0;i<13;i++){
    const a=i*Math.PI*2/13;
    c.strokeStyle=i%2?"#f7cf60":"#5bc6d9";c.lineWidth=7;c.beginPath();c.moveTo(128+Math.cos(a)*57,95+Math.sin(a)*57);c.lineTo(128+Math.cos(a)*76,95+Math.sin(a)*76);c.stroke();
  }
  c.fillStyle="#2d793f";c.beginPath();c.ellipse(128,355,130,69,0,0,Math.PI*2);c.fill();
  for(let i=0;i<24;i++){
    const x=27+(i*71)%204,y=267+(i*47)%145;
    c.fillStyle=i%3?"#48a375":"#d8a849";c.beginPath();c.arc(x,y,8+i%4*3,0,Math.PI*2);c.fill();
  }
  c.fillStyle="#f3d58c";c.beginPath();c.arc(128,171,25,0,Math.PI*2);c.fill();
  c.fillStyle="#e6b659";c.beginPath();c.arc(128,171,32,0,Math.PI*2);c.strokeStyle="#eec859";c.lineWidth=8;c.stroke();
  c.fillStyle="#f2d9af";c.beginPath();c.ellipse(128,178,15,24,0,0,Math.PI*2);c.fill();
  c.fillStyle="#c33c3d";c.beginPath();c.moveTo(112,203);c.lineTo(145,203);c.lineTo(178,377);c.lineTo(82,377);c.closePath();c.fill();
  c.fillStyle="#f1e6c9";c.beginPath();c.moveTo(112,205);c.lineTo(126,204);c.lineTo(118,360);c.lineTo(93,368);c.closePath();c.fill();
  c.strokeStyle="#e8d6ae";c.lineWidth=13;c.lineCap="round";c.beginPath();c.moveTo(118,220);c.lineTo(89,266);c.moveTo(139,221);c.lineTo(169,260);c.stroke();
  c.fillStyle="#dfad42";c.fillRect(20,422,216,16);c.fillRect(20,472,216,13);
  c.fillStyle="#254e76";c.fillRect(27,438,202,34);
  for(let x=32;x<226;x+=19){c.fillStyle=x%2?"#79cdd6":"#edd477";c.fillRect(x,443,11,22);}
  c.strokeStyle="#172f40";c.lineWidth=5;c.strokeRect(18,0,220,512);
  for(const y of[128,256,384,438]){c.beginPath();c.moveTo(20,y);c.lineTo(236,y);c.stroke();}
  c.beginPath();c.moveTo(128,0);c.lineTo(128,512);c.stroke();
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;return texture;
}

// Deterministic multi-scale wear: the basilica should age in coherent patches
// (rain runs below cornices, warm clouding on plaster), not per-block confetti.
export function createHeritageMaterials(renderer: THREE.WebGLRenderer) {
  const textures: THREE.Texture[] = [];
  const palette: Record<SurfaceName, string> = {
    marble: "#e8e3d8", stone: "#858b84", granite: "#b9897c", tile: "#ab603e", wood: "#513724",
    gold: "#c6a34d", iron: "#3a3835", recess: "#2a2622", moss: "#4a6b3a", glass: "#b6c8c3", stainedGlass: "#ffffff", ribbon: "#ffffff", mosaic: "#ffffff",
  };
  const output = {} as Record<SurfaceName, THREE.MeshStandardMaterial>;
  for (const [name, base] of Object.entries(palette) as [SurfaceName, string][]) {
    if(name==="glass"){
      output[name]=new THREE.MeshPhysicalMaterial({color:base,roughness:.16,metalness:0,transparent:true,opacity:.12,depthWrite:false,clearcoat:.65,clearcoatRoughness:.18,vertexColors:true});
      continue;
    }
    if(name==="stainedGlass"){
      const map=stainedGlassTexture();textures.push(map);
      output[name]=new THREE.MeshStandardMaterial({map,side:THREE.DoubleSide,roughness:.28,metalness:0,emissive:0xffffff,emissiveMap:map,emissiveIntensity:0,vertexColors:true});
      continue;
    }
    if(name==="ribbon"){
      output[name]=new THREE.MeshStandardMaterial({color:base,roughness:.82,metalness:0,side:THREE.DoubleSide,vertexColors:true});
      continue;
    }
    if(name==="mosaic"){
      output[name]=new THREE.MeshStandardMaterial({color:base,roughness:.5,metalness:.08,vertexColors:true});
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
