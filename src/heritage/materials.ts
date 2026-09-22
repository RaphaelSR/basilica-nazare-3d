import * as THREE from "three";

export type SurfaceName = "marble" | "stone" | "tile" | "wood" | "gold" | "iron" | "recess" | "moss" | "glass";

// Deterministic multi-scale wear: the basilica should age in coherent patches
// (rain runs below cornices, warm clouding on plaster), not per-block confetti.
export function createHeritageMaterials(renderer: THREE.WebGLRenderer) {
  const textures: THREE.Texture[] = [];
  const palette: Record<SurfaceName, string> = {
    marble: "#e6e0d3", stone: "#8f8d86", tile: "#b0603a", wood: "#4d3323",
    gold: "#b48d3c", iron: "#3a3835", recess: "#2a2622", moss: "#4a6b3a", glass: "#b6c8c3",
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
    if (name === "marble") {
      // Faint diagonal veins and thin rain runs; lime render, not polished stone.
      for (let i = 0; i < 14; i++) {
        let x = rand() * size, y = rand() * size, a = .6 + rand() * .5;
        ctx.strokeStyle = "rgba(150,140,120,.10)"; ctx.lineWidth = .6 + rand() * .9; ctx.beginPath(); ctx.moveTo(x, y);
        for (let k = 0; k < 14; k++) { a += (rand() - .5) * .5; x += Math.cos(a) * 18; y += Math.sin(a) * 18; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      for(let i=0;i<30;i++){
        const x=rand()*size,w=2+rand()*14,h=30+rand()*160;
        const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,"rgba(95,95,75,.10)");g.addColorStop(1,"rgba(95,95,75,0)");
        ctx.fillStyle=g;ctx.fillRect(x,0,w,h);
      }
    }
    if (name === "stone") {
      // Granite: dense dark and pale flecks.
      for (let i = 0; i < 9000; i++) { ctx.fillStyle = rand() > .5 ? "rgba(40,40,42,.22)" : "rgba(220,220,214,.18)"; const s = .6 + rand() * 1.4; ctx.fillRect(rand() * size, rand() * size, s, s); }
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
      const v=128+(rand()-.5)*(name==="stone"?65:name==="marble"?22:32)+grain;
      pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=v;pixels.data[i+3]=255;
    }
    dc.putImageData(pixels,0,0);
    const bump=new THREE.CanvasTexture(detail);bump.wrapS=bump.wrapT=THREE.RepeatWrapping;bump.anisotropy=texture.anisotropy;textures.push(bump);
    const roughCanvas=document.createElement("canvas");roughCanvas.width=roughCanvas.height=256;
    const rc=roughCanvas.getContext("2d")!;rc.fillStyle=name==="tile"?"#b4b4b4":name==="wood"?"#d4d4d4":name==="gold"?"#8a8a8a":"#ededed";rc.fillRect(0,0,256,256);
    for(let i=0;i<90;i++){rc.fillStyle=`rgba(60,60,60,${.02+rand()*.045})`;rc.fillRect(rand()*256,rand()*256,8+rand()*35,8+rand()*35);}
    const roughness=new THREE.CanvasTexture(roughCanvas);roughness.wrapS=roughness.wrapT=THREE.RepeatWrapping;textures.push(roughness);
    output[name]=new THREE.MeshStandardMaterial({
      map:texture,bumpMap:bump,roughnessMap:roughness,
      bumpScale:name==="marble"?.012:name==="tile"?.008:.024,
      roughness:name==="gold"?.5:name==="iron"?.7:name==="tile"?.84:.95,
      metalness:name==="gold"?.7:name==="iron"?.4:0,vertexColors:true,
    });
  }
  return {materials:output,dispose(){textures.forEach(t=>t.dispose());Object.values(output).forEach(m=>m.dispose());}};
}
