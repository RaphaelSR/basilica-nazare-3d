import * as THREE from "three";
import { HeritageBuilder, type Point } from "./builder";
import type { SurfaceName } from "./materials";

// Basílica Santuário de Nossa Senhora de Nazaré (Belém, PA) — a stylised
// neoclassical miniature: one tall hall under a single terracotta gable roof,
// twin bell towers crowned by round colonnaded tempietti and domes, a pink-granite
// portico, a gilded pediment, a semicircular apse, and the lower chapel wing with
// its arcaded gallery on the left flank. Scene units; about 34 units tall.

const TAU=Math.PI*2;
const variation=(n:number)=>{const v=Math.sin(n*127.1+31.7)*43758.5453;return v-Math.floor(v);};
const facePoint=(x:number,y:number,z:number,angle:number):Point=>[x*Math.cos(angle)+z*Math.sin(angle),y,z*Math.cos(angle)-x*Math.sin(angle)];
const snap=(v:number,step=.05)=>Math.round(v/step)*step;

function surfaceGrid(nx:number,ny:number,point:(u:number,v:number)=>Point,flip=false){
  const p:number[]=[],uv:number[]=[],idx:number[]=[];
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){const u=i/nx,v=j/ny;p.push(...point(u,v));uv.push(u,v);}
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
    const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;
    if(flip)idx.push(a,b,c,b,d,c);else idx.push(a,c,b,b,c,d);
  }
  const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(p,3));g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}

// ---------- Design constants ----------
const PLINTH=1.2, STRING=8.6, WALL_TOP=16, RIDGE=21.3, PED_BASE=16.72, PED_APEX=19.2;
const WALL_X=11, FRONT=20, REAR=-20, APSE_R=6.2, NAVE_X=6.5;
const EAVE_X=11.8, EAVE_Y=16.55;
const TOWER_X=8.95, TOWER_Z=19.6, TOWER_HW=2.8, SHAFT_TOP=20.5, BELL_BASE=21.3, BELL_TOP=25, DRUM_BASE=25.75;
const TEMPIETTO_H=2.3, DOME_BASE=DRUM_BASE+.3+TEMPIETTO_H+.65;
const ANNEX_X=16.5, ANNEX_TOP=8.4, ANNEX_Z0=-13, ANNEX_Z1=13, GALLERY_TOP=5.2, GALLERY_X=17, GALLERY_Z=22;
const FRONT_S=(x:number)=>x+6.15;
const gableHalfWidth=(y:number)=>y<EAVE_Y?WALL_X:Math.min(WALL_X,EAVE_X*(1-(y-EAVE_Y)/(RIDGE-EAVE_Y))-.2);
const pedimentHalfWidth=(y:number)=>6.15*(1-(y-PED_BASE)/(PED_APEX-PED_BASE));

// ---------- One normalised clock ----------
// Masonry rises as a horizontal wave from the ground; later stages are fixed offsets.
const T={
  mason:(y:number)=>y<PLINTH?.012+(y/PLINTH)*.085:.10+(y-PLINTH)/(SHAFT_TOP-PLINTH)*.36,
  bell:(y:number)=>.48+(y-BELL_BASE)/(BELL_TOP-BELL_BASE)*.12,
};

// ---------- Wall helpers ----------
type Void=(s:number,y:number)=>boolean;
type Surface=SurfaceName|[SurfaceName,number];
class Wall{
  readonly len:number;readonly yaw:number;readonly mid:Point;
  constructor(readonly a:Point,readonly b:Point){
    const dx=b[0]-a[0],dz=b[2]-a[2];this.len=Math.hypot(dx,dz);this.yaw=Math.atan2(-dz,dx);this.mid=[(a[0]+b[0])/2,0,(a[2]+b[2])/2];
  }
  /** Point at distance `s` along the wall, height `y`, offset `out` along the outward normal. */
  at(s:number,y:number,out=0):Point{const p=facePoint(s-this.len/2,0,out,this.yaw);return[this.mid[0]+p[0],y,this.mid[2]+p[2]];}
  rot(tilt=0):Point{return[0,this.yaw,tilt];}
}
const arch=(s:number,w:number,yb:number,yt:number):Void=>(ss,y)=>{
  if(y<yb||y>yt)return false;const r=w/2,cy=yt-r;
  const hw=y<cy?r:Math.sqrt(Math.max(0,r*r-(y-cy)**2));return Math.abs(ss-s)<hw;
};
const circle=(s:number,cy:number,r:number):Void=>(ss,y)=>(ss-s)**2+(y-cy)**2<r*r;
const rect=(s:number,w:number,yb:number,yt:number):Void=>(ss,y)=>y>=yb&&y<=yt&&Math.abs(ss-s)<w/2;
// Grey-green and white marble banding on the lower storey of the front.
const banded=(row:number,y:number):Surface=>y<9.6&&Math.floor(row/2)%2===1?["stone",.82]:"marble";

interface CourseSpec{y0:number;y1:number;thick?:number;course?:number;block?:number;out?:number;voids?:Void[];
  extent?:(y:number)=>[number,number]|null;material:(row:number,y:number)=>Surface;start:(y:number)=>number;shade?:number;lift?:number}
/** Lay real courses along a wall: staggered blocks, hairline joints, openings as true voids. */
function courses(b:HeritageBuilder,w:Wall,spec:CourseSpec){
  const thick=spec.thick??.62,course=spec.course??.3,block=spec.block??1.0,voids=spec.voids??[],out=spec.out??0;
  for(let row=0,yb=spec.y0;yb<spec.y1-.01;row++,yb+=course){
    const h=Math.min(course,spec.y1-yb),yc=yb+h/2;
    const ext=spec.extent?spec.extent(yc):[0,w.len];if(!ext||ext[1]-ext[0]<.12)continue;
    const runs:[number,number][]=[];let open:number|null=null;const step=.05;
    for(let s=ext[0];s<ext[1]+step/2;s+=step){
      const solid=s<ext[1]-1e-6&&!voids.some(v=>v(s+step/2,yc));
      if(solid&&open===null)open=s;
      if(!solid&&open!==null){runs.push([open,Math.min(s,ext[1])]);open=null;}
    }
    if(open!==null)runs.push([open,ext[1]]);
    for(const [r0,r1]of runs){
      let s=r0,first=true;
      while(s<r1-.02){
        let width=first&&row%2?block*.55:block;first=false;
        if(s+width>r1-.3)width=r1-s;
        width=Math.max(width,.1);
        const surface=spec.material(row,yc);
        const [material,tone]=Array.isArray(surface)?surface:[surface,1];
        b.box([Math.max(.08,snap(width)-.02),snap(h,.01)-.015,thick],w.at(s+width/2,yc,out),material,spec.start(yc)+(s/w.len)*.004,
          {r:w.rot(),shade:(spec.shade??1)*tone*(.96+variation(row*31+s*7)*.07),lift:spec.lift??.3,duration:.01});
        s+=width;
      }
    }
  }
}
function strip(b:HeritageBuilder,w:Wall,y:number,h:number,out:number,depth:number,material:SurfaceName,start:number,shade=1){
  const e=out+depth/2;
  b.box([w.len+2*e,h,depth],w.at(w.len/2,y,out),material,start,{r:w.rot(),shade,lift:.3});
}
/** Classical cornice: lower fillet, dentils, projecting crown. Height ≈ .72·scale. */
function cornice(b:HeritageBuilder,walls:Wall[],y:number,start:number,scale=1){
  for(const w of walls){
    strip(b,w,y+.12*scale,.24*scale,.12*scale,.7,"marble",start,.97);
    for(let s=.25*scale;s<w.len-.1;s+=.45*scale)b.box([.16*scale,.2*scale,.22],w.at(s,y+.36*scale,.55*scale),"marble",start+.006,{r:w.rot(),shade:.88});
    strip(b,w,y+.6*scale,.24*scale,.45*scale,.7,"marble",start+.012,1.03);
  }
}
function archRing(b:HeritageBuilder,w:Wall,s:number,cy:number,rIn:number,rOut:number,depth:number,out:number,material:SurfaceName,start:number,segments=13,shade=.95){
  for(let i=0;i<segments;i++){
    const shape=new THREE.Shape(),t0=i*Math.PI/segments+.008,t1=(i+1)*Math.PI/segments-.008;
    shape.absarc(0,0,rOut,t0,t1,false);shape.absarc(0,0,rIn,t1,t0,true);shape.closePath();
    const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:.008,bevelSize:.008,bevelSegments:1,steps:1,curveSegments:4});g.translate(0,0,-depth/2);
    b.add(g,material,start+i*.0015,{p:w.at(s,cy,out),r:w.rot(),shade:shade+(i%3)*.02});g.dispose();
  }
}
function archWindow(b:HeritageBuilder,w:Wall,s:number,width:number,yb:number,yt:number,start:number){
  const r=width/2,cy=yt-r;
  b.box([width+.1,yt-yb+.1,.08],w.at(s,(yb+yt)/2,-.14),"recess",start,{r:w.rot()});
  b.box([width,yt-yb,.02],w.at(s,(yb+yt)/2,-.02),"glass",start+.004,{r:w.rot(),lift:.1});
  b.box([.05,yt-yb-.05,.05],w.at(s,(yb+yt)/2,-.02),"iron",start+.004,{r:w.rot()});
  for(let k=1;k<=2;k++)b.box([width-.05,.05,.05],w.at(s,yb+(cy-yb)*k/3,-.02),"iron",start+.004,{r:w.rot()});
  for(const dx of[-1,1])b.box([.24,cy-yb,.76],w.at(s+dx*(r+.11),(yb+cy)/2,.04),"marble",start,{r:w.rot(),shade:.93});
  b.box([width+.6,.2,.9],w.at(s,yb-.1,.08),"marble",start,{r:w.rot(),shade:.96});
  archRing(b,w,s,cy,r+.01,r+.25,.76,.04,"marble",start+.008);
}
function rectWindow(b:HeritageBuilder,w:Wall,s:number,width:number,yb:number,yt:number,start:number){
  b.box([width+.1,yt-yb+.1,.08],w.at(s,(yb+yt)/2,-.14),"recess",start,{r:w.rot()});
  b.box([width,yt-yb,.02],w.at(s,(yb+yt)/2,-.02),"glass",start+.004,{r:w.rot(),lift:.1});
  b.box([.05,yt-yb,.05],w.at(s,(yb+yt)/2,-.02),"iron",start+.004,{r:w.rot()});
  b.box([width-.05,.05,.05],w.at(s,(yb+yt)/2,-.02),"iron",start+.004,{r:w.rot()});
  for(const dx of[-1,1])b.box([.2,yt-yb+.3,.72],w.at(s+dx*(width/2+.1),(yb+yt)/2,.04),"marble",start,{r:w.rot(),shade:.93});
  b.box([width+.7,.24,.8],w.at(s,yt+.22,.06),"marble",start+.004,{r:w.rot(),shade:.95});
  b.box([width+.6,.18,.9],w.at(s,yb-.09,.08),"marble",start,{r:w.rot(),shade:.96});
}
function door(b:HeritageBuilder,w:Wall,s:number,width:number,yb:number,yt:number,start:number){
  const r=width/2,cy=yt-r,h=cy-yb;
  b.box([width+.12,h+.06,.1],w.at(s,(yb+cy)/2,-.2),"recess",start,{r:w.rot()});
  b.box([width-.08,h-.04,.16],w.at(s,(yb+cy)/2,-.12),"wood",start+.004,{r:w.rot(),shade:.9});
  for(const dx of[-1,1])for(const dy of[.28,.7])b.box([width*.34,h*.3,.05],w.at(s+dx*width*.24,yb+h*dy,-.03),"wood",start+.006,{r:w.rot(),shade:.68});
  b.box([.06,h,.06],w.at(s,(yb+cy)/2,-.03),"gold",start+.006,{r:w.rot()});
  b.box([width,r,.1],w.at(s,cy+r/2,-.2),"recess",start,{r:w.rot()});
  for(let k=0;k<5;k++){const a=k*Math.PI/4;b.box([.05,r*.95,.05],w.at(s+Math.cos(a)*r*.47,cy+Math.sin(a)*r*.47,-.1),"gold",start+.008,{r:w.rot(a-Math.PI/2)});}
  for(const dx of[-1,1])b.box([.3,h,.8],w.at(s+dx*(r+.13),(yb+cy)/2,.06),"marble",start,{r:w.rot(),shade:.92});
  archRing(b,w,s,cy,r+.02,r+.3,.8,.06,"marble",start+.01);
}
/** Corinthian-flavoured column: stepped base, tapering shaft, bell capital with volutes and abacus. Total height `h` above `p`. */
function column(b:HeritageBuilder,p:Point,h:number,r:number,start:number,shaftMaterial:SurfaceName="marble"){
  b.box([r*2.6,.22,r*2.6],[p[0],p[1]+.11,p[2]],"stone",start,{shade:.9});
  const torus=new THREE.TorusGeometry(r*1.12,r*.2,6,20);torus.rotateX(Math.PI/2);
  b.add(torus,"marble",start+.002,{p:[p[0],p[1]+.3,p[2]]});torus.dispose();
  const shaft=h-1.1,top=p[1]+.35+shaft;
  b.cylinder(r*.86,r,shaft,[p[0],p[1]+.35+shaft/2,p[2]],shaftMaterial,start+.004,{duration:.03,lift:3});
  b.cylinder(r*1.45,r*.86,.55,[p[0],top+.275,p[2]],"marble",start+.03,{shade:.95});
  for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;b.sphere([p[0]+Math.cos(a)*r*1.35,top+.5,p[2]+Math.sin(a)*r*1.35],[r*.28,r*.22,r*.28],"marble",start+.032,{shade:.85});}
  b.box([r*3,.2,r*3],[p[0],top+.65,p[2]],"marble",start+.034,{shade:1.02});
}
/** Slender polished-granite colonnette with a plain base and abacus. */
function colonnette(b:HeritageBuilder,p:Point,h:number,r:number,start:number){
  b.cylinder(r*1.4,r*1.5,.12,[p[0],p[1]+.06,p[2]],"marble",start,{shade:.95});
  b.cylinder(r*.92,r,h-.4,[p[0],p[1]+.12+(h-.4)/2,p[2]],"granite",start+.003,{duration:.02,lift:1.2});
  b.cylinder(r*1.3,r*.92,.14,[p[0],p[1]+h-.21,p[2]],"marble",start+.02,{shade:.95});
  b.box([r*2.8,.14,r*2.8],[p[0],p[1]+h-.07,p[2]],"marble",start+.022,{shade:1.02});
}
function balustrade(b:HeritageBuilder,w:Wall,y:number,start:number,h=.9){
  b.box([w.len+.3,.12,.3],w.at(w.len/2,y+.06),"marble",start,{r:w.rot(),shade:.96});
  b.box([w.len+.3,.15,.34],w.at(w.len/2,y+h),"marble",start+.01,{r:w.rot(),shade:1.02});
  for(let s=.3;s<w.len-.2;s+=.42)b.cylinder(.06,.09,h-.2,w.at(s,y+h/2-.03),"marble",start+.004,{shade:.95});
}
function angel(b:HeritageBuilder,p:Point,yaw:number,start:number,scale=1){
  const P=(x:number,y:number,z:number):Point=>{const q=facePoint(x*scale,y*scale,z*scale,yaw);return[p[0]+q[0],p[1]+q[1],p[2]+q[2]];};
  b.box([.7*scale,.35*scale,.7*scale],P(0,.17,0),"marble",start,{shade:.92,r:[0,yaw,0]});
  b.cylinder(.17*scale,.27*scale,.95*scale,P(0,.83,0),"marble",start+.002,{shade:1.04});
  b.sphere(P(0,1.2,.02),[.21*scale,.2*scale,.16*scale],"marble",start+.003,{shade:1.04});
  b.sphere(P(0,1.5,0),[.12*scale,.14*scale,.12*scale],"marble",start+.004,{shade:1.06});
  for(const sign of[-1,1])b.sphere(P(sign*.27,1.2,-.13),[.13*scale,.5*scale,.05*scale],"marble",start+.004,{r:[0,yaw,sign*.45],shade:1.08});
}
function cross(b:HeritageBuilder,p:Point,h:number,start:number){
  b.box([h*.1,h,h*.1],[p[0],p[1]+h/2,p[2]],"gold",start,{duration:.006,lift:.4});
  b.box([h*.55,h*.1,h*.1],[p[0],p[1]+h*.72,p[2]],"gold",start+.004,{duration:.006,lift:.4});
}
function clock(b:HeritageBuilder,w:Wall,s:number,y:number,start:number){
  const face=new THREE.CylinderGeometry(.95,.95,.08,32);face.rotateX(Math.PI/2);
  b.add(face,"marble",start,{p:w.at(s,y,.3),r:w.rot(),shade:1.12});face.dispose();
  const ring=new THREE.TorusGeometry(.98,.07,6,32);b.add(ring,"iron",start+.003,{p:w.at(s,y,.34),r:w.rot()});ring.dispose();
  for(let i=0;i<12;i++){const a=i/12*TAU;b.box([.05,i%3?.1:.18,.03],w.at(s+Math.sin(a)*.8,y+Math.cos(a)*.8,.36),"iron",start+.004,{r:w.rot(-a)});}
  b.box([.07,.55,.04],w.at(s,y+.24,.37),"iron",start+.005,{r:w.rot(-.55)});
  b.box([.07,.75,.04],w.at(s,y-.3,.37),"iron",start+.005,{r:w.rot(.35)});
}
function palm(b:HeritageBuilder,x:number,z:number,h:number,seed:number){
  const lean=(variation(seed)-.5)*.9,frond=b.geo("frond",()=>new THREE.SphereGeometry(1,8,5));
  b.box([1.3,.2,1.3],[x,.05,z],"stone",-1,{lift:0,shade:.9});
  const top:Point=[x+lean,h,z+lean*.3];
  b.tube([[x,0,z],[x+lean*.3,h*.5,z],top],.2,"wood",-1,{lift:0,shade:.82},10);
  for(let i=0;i<9;i++){
    const a=i/9*TAU+seed*.7,dx=Math.cos(a),dz=Math.sin(a);
    b.tube([top,[top[0]+dx*1.4,top[1]+.55,top[2]+dz*1.4],[top[0]+dx*3,top[1]-.5,top[2]+dz*3]],.045,"wood",-1,{lift:0,shade:.9},8);
    for(let k=0;k<3;k++){
      const t=(k+.5)/3,r=1.1+t*1.9;
      b.add(frond,"moss",-1,{p:[top[0]+dx*r,top[1]+.55-t*1.05,top[2]+dz*r],s:[.85,.06,.34],r:[0,-a,-.32-t*.25],lift:0,shade:.8+variation(seed*9+i*3+k)*.35});
    }
  }
}
/** Terracotta roof: opaque deck, wooden fascia, then rows of overlapping curved tiles from eave to ridge. */
function tiledSlope(b:HeritageBuilder,eaveA:Point,eaveB:Point,up:Point,start:number){
  const A=new THREE.Vector3(...eaveA),B=new THREE.Vector3(...eaveB),U=new THREE.Vector3(...up);
  const along=B.clone().sub(A),len=along.length();along.normalize();
  const slope=U.length(),upN=U.clone().normalize();
  const n=new THREE.Vector3().crossVectors(along,upN);if(n.y<0)n.negate();
  const flip=new THREE.Vector3().crossVectors(upN,along).dot(n)<0;
  const at=(x:number,v:number,h:number)=>A.clone().addScaledVector(along,x).addScaledVector(upN,v).addScaledVector(n,h);
  const deck=surfaceGrid(2,2,(u,v)=>{const p=at(u*len,v*slope,.02);return[p.x,p.y,p.z];},flip);
  b.add(deck,"tile",start,{shade:.7,duration:.02,lift:.4});deck.dispose();
  const yaw=Math.atan2(-along.z,along.x),fascia=at(len/2,-.04,-.1);
  b.box([len+.1,.3,.14],[fascia.x,fascia.y,fascia.z],"wood",start,{r:[0,yaw,0],shade:.9});
  const spacing=.32,rowStep=.6,tileLen=.68,cols=Math.floor(len/spacing),rows=Math.ceil(slope/rowStep);
  for(let j=0;j<rows;j++){
    const v0=j*rowStep,v1=Math.min(v0+tileLen,slope+.1);
    for(let i=0;i<=cols;i++){
      const x=i*spacing+spacing/2;if(x>len)continue;
      const seed=i*13+j*47+start*1000;
      const g=surfaceGrid(5,1,(u,v)=>{const th=(1-u)*Math.PI;const p=at(x+Math.cos(th)*.15,v0+(v1-v0)*v,.03+Math.sin(th)*.11);return[p.x,p.y,p.z];},flip);
      b.add(g,"tile",start+.01+j*.0045+i*.0001,{shade:.88+variation(seed)*.2,tint:[1,.96+variation(seed+1)*.07,.94+variation(seed+2)*.09],duration:.012,lift:.25});g.dispose();
    }
  }
}
/** Gable roof with king-post trusses, purlins, ridge beam, two tiled slopes and ridge tiles. */
function gableRoof(b:HeritageBuilder,cx:number,halfSpan:number,eaveY:number,ridgeY:number,z0:number,z1:number,trussStep:number,start:number,heavy=true){
  const rise=ridgeY-eaveY,rake=Math.atan2(rise,halfSpan),rakeLen=Math.hypot(halfSpan,rise),len=z1-z0;
  for(let z=z0+trussStep/2,i=0;z<z1;z+=trussStep,i++){
    const t=start+i*.004;
    b.box([2*halfSpan-.6,heavy?.32:.22,heavy?.3:.2],[cx,eaveY-.35,z],"wood",t,{duration:.02,lift:2});
    for(const sign of[-1,1])b.box([rakeLen,heavy?.3:.2,heavy?.26:.18],[cx+sign*halfSpan/2,(eaveY+ridgeY)/2-.1,z],"wood",t+.004,{r:[0,0,-sign*rake],duration:.02,lift:2});
    if(heavy)b.box([.26,rise-.5,.26],[cx,(eaveY+ridgeY)/2-.1,z],"wood",t+.002,{duration:.02,lift:2});
  }
  for(const t of(heavy?[.25,.5,.75]:[.5]))for(const sign of[-1,1])b.box([.2,.2,len-1],[cx+sign*halfSpan*(1-t),eaveY+rise*t-.18,(z0+z1)/2],"wood",start+.04,{lift:1});
  b.box([.26,.34,len-1],[cx,ridgeY-.15,(z0+z1)/2],"wood",start+.042,{lift:1});
  tiledSlope(b,[cx+halfSpan,eaveY,z1],[cx+halfSpan,eaveY,z0],[-halfSpan,rise,0],start+.055);
  tiledSlope(b,[cx-halfSpan,eaveY,z0],[cx-halfSpan,eaveY,z1],[halfSpan,rise,0],start+.055);
  const ridgeStart=start+.055+.01+Math.ceil(rakeLen/.6)*.0045;
  for(let i=0,z=z0+.1;z<z1;z+=.64,i++)b.cylinder(.2,.21,.6,[cx,ridgeY+.12,z],"tile",ridgeStart+i*.0003,{r:[Math.PI/2,0,0],shade:1+variation(i)*.12});
}

// ---------- Praça Santuário ----------
export function courtyard(b:HeritageBuilder){
  b.box([70,.4,96],[0,-.42,0],"stone",-1,{lift:0,shade:.9});
  for(let i=-11;i<=11;i++)for(let j=-15;j<=15;j++){
    const x=i*3,z=j*3;
    if(Math.abs(x)<12.5&&z>-27&&z<24.5)continue;
    if(x<-10&&x>-19&&z>-15&&z<24.5)continue;
    b.box([2.92,.08,2.92],[x,-.1+(variation(i*7+j*13)-.5)*.01,z],"stone",-1,{lift:0,shade:(i+j)%2?.84:1});
  }
  for(let i=0;i<5;i++)b.box([15-i*.3,.24,.92],[0,.12+i*.24,24.85+(4-i)*.9],"stone",.004+i*.002,{lift:.2,shade:1.06});
  for(let x=-14;x<=14;x+=2){if(Math.abs(x)<3)continue;b.box([.18,1.3,.18],[x,.65,31],"iron",-1,{lift:0});b.sphere([x,1.36,31],[.11,.11,.11],"iron",-1,{lift:0});}
  for(const sign of[-1,1])for(const y of[.55,1.15])b.box([11.2,.06,.06],[sign*8.5,y,31],"iron",-1,{lift:0});
  for(let x=-13.5;x<=13.5;x+=.5){if(Math.abs(x)<3)continue;b.box([.04,1.05,.04],[x,.6,31],"iron",-1,{lift:0});}
  for(let i=0;i<7;i++)palm(b,17,-18+i*6.2,8.5+variation(i)*2,i);
  for(let i=0;i<4;i++)palm(b,-21.5,-14+i*7,8+variation(i+9)*2.5,i+9);
  for(const sign of[-1,1]){b.cylinder(.08,.13,3.6,[sign*9.5,1.8,29.5],"iron",-1,{lift:0});b.sphere([sign*9.5,3.85,29.5],[.26,.34,.26],"glass",-1,{lift:0});}
}

// ---------- Building ----------
function colonnade(b:HeritageBuilder){
  // Interior arcade: the hall's roof trusses bear on the walls, the colonnade carries the galleries inside.
  for(const sign of[-1,1]){
    for(let i=0;i<10;i++){const z=-18+i*4;column(b,[sign*NAVE_X,PLINTH,z],7.85,.42,.05+i*.003);}
    b.box([.75,.55,40],[sign*NAVE_X,9.325,0],"marble",.095,{duration:.02,lift:1,shade:.95});
  }
}
function sideWalls(b:HeritageBuilder){
  // One tall flank per side: rectangular windows below the string course, arched above, pilasters between bays.
  for(const sign of[-1,1]){
    const w=sign>0?new Wall([WALL_X,0,16.8],[WALL_X,0,REAR]):new Wall([-WALL_X,0,REAR],[-WALL_X,0,16.8]);
    const sOf=(z:number)=>sign>0?16.8-z:z-REAR;
    const zs=[-16,-12,-8,-4,0,4,8,12];
    const voids=[...zs.map(z=>rect(sOf(z),1.4,3.2,7.2)),...zs.map(z=>arch(sOf(z),1.5,10.6,14.4))];
    courses(b,w,{y0:0,y1:PLINTH,course:.4,block:1.3,material:()=>"stone",start:T.mason,shade:.9});
    courses(b,w,{y0:PLINTH,y1:WALL_TOP,voids,material:()=>"marble",start:T.mason});
    for(const z of zs){rectWindow(b,w,sOf(z),1.4,3.2,7.2,.30);archWindow(b,w,sOf(z),1.5,10.6,14.4,.42);}
    for(const z of[-18,-14,-10,-6,-2,2,6,10,14])for(let k=0;k<7;k++){const y=PLINTH+1.06+k*2.11;b.box([.7,2.06,.32],w.at(sOf(z),y,.3),"marble",T.mason(y),{r:w.rot(),shade:1.03});}
    strip(b,w,STRING,.28,.2,.7,"marble",T.mason(STRING)+.01,1.02);
    cornice(b,[w],WALL_TOP,.385);
  }
}
function rearAndApse(b:HeritageBuilder){
  const w=new Wall([WALL_X,0,REAR],[-WALL_X,0,REAR]);
  const extent=(y:number):[number,number]|null=>{
    if(y<WALL_TOP)return[0,w.len];
    const hw=gableHalfWidth(y);return hw<.3?null:[WALL_X-hw,WALL_X+hw];
  };
  courses(b,w,{y0:0,y1:PLINTH,course:.4,block:1.3,material:()=>"stone",start:T.mason,shade:.9});
  courses(b,w,{y0:PLINTH,y1:RIDGE-.3,extent,material:()=>"marble",start:T.mason});
  strip(b,w,STRING,.28,.2,.7,"marble",T.mason(STRING)+.01,1.02);
  cornice(b,[w],WALL_TOP,.385);
  // Apse: eleven facets on a semicircle, three arched windows, conical tiled roof.
  const N=11,half=APSE_R*Math.tan(Math.PI/(2*N)),faces:Wall[]=[];
  for(let i=0;i<N;i++){
    const th=Math.PI/2+Math.PI/(2*N)+i*Math.PI/N,c=[APSE_R*Math.sin(th),REAR+APSE_R*Math.cos(th)],d=[Math.cos(th),-Math.sin(th)];
    const f=new Wall([c[0]-d[0]*half,0,c[1]-d[1]*half],[c[0]+d[0]*half,0,c[1]+d[1]*half]);faces.push(f);
    const windowed=i===2||i===5||i===8;
    courses(b,f,{y0:0,y1:PLINTH,course:.4,block:1.2,material:()=>"stone",start:T.mason,shade:.9});
    courses(b,f,{y0:PLINTH,y1:12.6,block:.9,voids:windowed?[arch(half,1.2,4.6,9)]:[],material:()=>"marble",start:T.mason});
    if(windowed)archWindow(b,f,half,1.2,4.6,9,.30);
    for(let k=0;k<3;k++){const y=PLINTH+1.9+k*3.8;b.box([.55,3.75,.3],f.at(0,y,.28),"marble",T.mason(y),{r:f.rot(),shade:1.03});}
  }
  cornice(b,faces,12.6,.34,.8);
  const cone=surfaceGrid(22,4,(u,v)=>{const th=Math.PI/2+u*Math.PI,r=6.75*(1-v);return[r*Math.sin(th),13.2+v*3.3,REAR+r*Math.cos(th)];},true);
  b.add(cone,"tile",.36,{shade:.8,duration:.03,lift:.6});cone.dispose();
  for(let i=0;i<=16;i++){
    const th=Math.PI/2+i*Math.PI/16,pts:Point[]=[];
    for(let k=0;k<=4;k++){const t=k/4,r=6.8*(1-t)+.15;pts.push([r*Math.sin(th),13.22+t*3.3,REAR+r*Math.cos(th)]);}
    b.tube(pts,.12,"tile",.375+i*.002,{shade:1.05},6);
  }
  b.sphere([0,16.6,REAR],[.3,.3,.3],"stone",.40);
}
function facade(b:HeritageBuilder){
  const w=new Wall([-6.15,0,FRONT],[6.15,0,FRONT]);
  const doors:[number,number,number][]=[[0,2.6,6.6],[-4.42,1.05,5.2],[4.42,1.05,5.2]];
  const voids=[...doors.map(([x,wd,yt])=>arch(FRONT_S(x),wd,PLINTH,yt)),circle(FRONT_S(0),13.4,1.4),arch(FRONT_S(-3.75),1.1,11.4,14.1),arch(FRONT_S(3.75),1.1,11.4,14.1)];
  courses(b,w,{y0:0,y1:PLINTH,course:.4,block:1.3,material:()=>"stone",start:T.mason,shade:.9});
  courses(b,w,{y0:PLINTH,y1:WALL_TOP,voids,material:banded,start:T.mason});
  cornice(b,[w],WALL_TOP,.39);
  // Gilded tympanum in front; the plain gable wall of the main roof rises behind it.
  courses(b,w,{y0:PED_BASE,y1:PED_APEX-.12,thick:.45,out:-.08,block:.8,extent:y=>{const hw=pedimentHalfWidth(y)-.3;return hw<.3?null:[FRONT_S(-hw),FRONT_S(hw)];},material:()=>["gold",.95],start:T.mason});
  courses(b,w,{y0:PED_BASE,y1:RIDGE-.3,thick:.4,out:-.55,block:.9,extent:y=>{const hw=Math.min(6.15,gableHalfWidth(y));return hw<.3?null:[FRONT_S(-hw),FRONT_S(hw)];},material:()=>"marble",start:T.mason});
  const pedRise=PED_APEX-PED_BASE,rake=Math.atan2(pedRise,6.15),rakeLen=Math.hypot(6.15,pedRise);
  for(const sign of[-1,1])b.box([rakeLen+.3,.42,.8],[sign*6.15/2,(PED_BASE+PED_APEX)/2+.2,FRONT+.42],"marble",.47,{r:[0,0,-sign*rake],shade:1.02,duration:.02,lift:.6});
  const roofRake=Math.atan2(RIDGE-EAVE_Y,EAVE_X),roofRakeLen=Math.hypot(EAVE_X,RIDGE-EAVE_Y);
  for(const sign of[-1,1])b.box([roofRakeLen,.36,.6],[sign*EAVE_X/2,(EAVE_Y+RIDGE)/2+.15,FRONT-.05],"marble",.47,{r:[0,0,-sign*roofRake],shade:1.0,duration:.02,lift:.6});
  b.box([12.3,.32,.06],w.at(w.len/2,15.55,.36),"gold",.60,{r:w.rot()});
  for(const x of[-5.4,5.4])b.box([.06,5.2,.9],w.at(FRONT_S(x),13.1,.34),"gold",.60,{r:w.rot()});
  b.sphere(w.at(w.len/2,17.5,.18),[.3,.5,.22],"marble",.93,{shade:1.08});
  b.sphere(w.at(w.len/2,18.15,.18),[.16,.17,.14],"marble",.933,{shade:1.08});
  // Rose window: stone ring, gilded spokes, dark reveal and glazing.
  const ring=new THREE.TorusGeometry(1.5,.16,8,48);b.add(ring,"stone",.62,{p:w.at(FRONT_S(0),13.4,.22),r:w.rot(),shade:.95});ring.dispose();
  const inner=new THREE.TorusGeometry(.5,.06,6,24);b.add(inner,"gold",.63,{p:w.at(FRONT_S(0),13.4,.1),r:w.rot()});inner.dispose();
  for(let k=0;k<6;k++)b.box([.07,2.75,.07],w.at(FRONT_S(0),13.4,.1),"gold",.632+k*.001,{r:w.rot(k*Math.PI/6)});
  const reveal=new THREE.CylinderGeometry(1.42,1.42,.06,40);reveal.rotateX(Math.PI/2);b.add(reveal,"recess",.62,{p:w.at(FRONT_S(0),13.4,-.1),r:w.rot()});reveal.dispose();
  const glazing=new THREE.CircleGeometry(1.4,40);b.add(glazing,"glass",.635,{p:w.at(FRONT_S(0),13.4,.02),r:w.rot(),lift:.1});glazing.dispose();
  for(const x of[-3.75,3.75]){
    b.box([1.2,2.8,.1],w.at(FRONT_S(x),12.75,-.16),"recess",.44,{r:w.rot()});
    b.box([1.5,.2,.7],w.at(FRONT_S(x),11.3,.1),"marble",.44,{r:w.rot(),shade:.95});
    archRing(b,w,FRONT_S(x),13.55,.56,.78,.7,.04,"marble",.45);
    if(x>0)angel(b,w.at(FRONT_S(x),11.4,-.05),0,.9,.75);
  }
  for(const [x,wd,yt]of doors)door(b,w,FRONT_S(x),wd,PLINTH,yt,.66);
  for(const x of[-5.9,5.9])angel(b,w.at(FRONT_S(x),PED_BASE,.3),0,.94,1.05);
  cross(b,[0,PED_APEX+.1,FRONT+.35],1.4,.975);
}
function portico(b:HeritageBuilder){
  const w=new Wall([-6.15,0,FRONT],[6.15,0,FRONT]),xs=[-5.35,-3.5,-1.7,1.7,3.5,5.35];
  xs.forEach((x,i)=>{
    column(b,[x,PLINTH,23.4],8.4,.36,.20+i*.008,"granite");
    for(let k=0;k<4;k++){const y=PLINTH+1.05+k*2.1;b.box([.8,2.05,.3],w.at(FRONT_S(x),y,.42),"marble",T.mason(y),{r:w.rot(),shade:1.03});}
  });
  b.box([13,.55,4.1],[0,9.875,22.05],"marble",.30,{duration:.03,lift:1,shade:.98});
  b.box([12.6,.3,.06],[0,9.9,24.14],"gold",.31);
  b.box([13.6,.28,4.6],[0,10.3,22.1],"marble",.32,{duration:.02,lift:.6,shade:1.03});
  for(let x=-6.4;x<=6.4;x+=.45)b.box([.16,.2,.22],[x,10.02,24.3],"marble",.315,{shade:.88});
  // Pierced parapet over the portico.
  balustrade(b,new Wall([-6.3,0,24.05],[6.3,0,24.05]),10.5,.34);
  balustrade(b,new Wall([6.55,0,24.05],[6.55,0,20.5]),10.5,.345);
  balustrade(b,new Wall([-6.55,0,20.5],[-6.55,0,24.05]),10.5,.345);
  for(const x of[-6.55,6.55])b.box([.5,1.15,.5],[x,11.05,24.05],"marble",.34,{shade:1.02});
}
function mainRoof(b:HeritageBuilder){
  gableRoof(b,0,EAVE_X,EAVE_Y,RIDGE,-20.7,20.7,4,.40);
  const rake=Math.atan2(RIDGE-EAVE_Y,EAVE_X),rakeLen=Math.hypot(EAVE_X,RIDGE-EAVE_Y);
  for(const sign of[-1,1])b.box([rakeLen+.2,.42,.8],[sign*EAVE_X/2,(EAVE_Y+RIDGE)/2+.18,REAR-.42],"marble",.47,{r:[0,0,-sign*rake],shade:1.02,duration:.02,lift:.6});
  // Small dormers, three per slope, low on the roof.
  for(const sign of[-1,1])for(const z of[-11,-1,9]){
    const t=.3,x=sign*EAVE_X*(1-t),y=EAVE_Y+(RIDGE-EAVE_Y)*t;
    b.box([.7,.75,1],[x,y+.42,z],"marble",.58,{shade:1.02});
    b.box([.02,.4,.5],[x+sign*.36,y+.42,z],"recess",.584);
    for(const side of[-1,1])b.box([.9,.06,.64],[x,y+.95,z+side*.24],"tile",.586,{r:[side*.7,0,0],shade:.9});
  }
}
function tower(b:HeritageBuilder,sign:number){
  const cx=sign*TOWER_X,cz=TOWER_Z,hw=TOWER_HW;
  // Faces in order front (+z), right (+x), rear (-z), left (-x); each traversed so its outward normal is local +z.
  const square=(h:number):Wall[]=>[
    new Wall([cx-h,0,cz+h],[cx+h,0,cz+h]),
    new Wall([cx+h,0,cz+h],[cx+h,0,cz-h]),
    new Wall([cx+h,0,cz-h],[cx-h,0,cz-h]),
    new Wall([cx-h,0,cz-h],[cx-h,0,cz+h]),
  ];
  const faces=square(hw),outer=sign>0?1:3;
  faces.forEach((f,i)=>{
    const voids:Void[]=[];
    if(i===0)voids.push(arch(hw,1.1,11.8,14.4),rect(hw,1,4.6,6.9),circle(hw,18.3,1.05));
    if(i===outer)voids.push(arch(hw,1.1,11.8,14.4),circle(hw,18.3,1.05));
    courses(b,f,{y0:0,y1:PLINTH,course:.4,block:1.3,material:()=>"stone",start:T.mason,shade:.9});
    courses(b,f,{y0:PLINTH,y1:SHAFT_TOP,block:.95,voids,material:banded,start:T.mason});
    if(i===0){archWindow(b,f,hw,1.1,11.8,14.4,.44);rectWindow(b,f,hw,1,4.6,6.9,.44);}
    if(i===outer)archWindow(b,f,hw,1.1,11.8,14.4,.44);
    if(i===0||i===outer){clock(b,f,hw,18.3,.47);b.box([hw*2-.4,.3,.06],f.at(hw,15.55,.34),"gold",.60,{r:f.rot()});}
  });
  for(const dx of[-1,1])for(const dz of[-1,1])for(let k=0;k<5;k++){const y=PLINTH+1.93+k*3.86;b.box([.75,3.8,.75],[cx+dx*hw,y,cz+dz*hw],"marble",T.mason(y),{shade:1.03});}
  cornice(b,faces,9.6,.28,.7);cornice(b,faces,WALL_TOP,.39,.7);cornice(b,faces,SHAFT_TOP,.465,1.1);
  // Bell stage: four open arches with low balustrades, paired pink colonnettes at the corners, a real bell inside.
  const bhw=2.45,bell=square(bhw);
  bell.forEach(f=>{
    courses(b,f,{y0:BELL_BASE,y1:BELL_TOP,block:.9,voids:[arch(bhw,1.7,BELL_BASE+.5,BELL_TOP-.35)],material:()=>"marble",start:T.bell});
    archRing(b,f,bhw,BELL_TOP-.35-.85,.86,1.1,.72,.02,"marble",.60,11,.92);
    b.box([2.2,.2,.75],f.at(bhw,BELL_BASE+.4,.06),"marble",.49,{r:f.rot(),shade:.95});
    b.box([1.7,.08,.16],f.at(bhw,BELL_BASE+1.3,.02),"marble",.61,{r:f.rot(),shade:.96});
    for(const dx of[-.55,-.18,.18,.55])b.cylinder(.05,.06,.7,f.at(bhw+dx,BELL_BASE+.9,.02),"marble",.612,{shade:.95});
  });
  for(const dx of[-1,1])for(const dz of[-1,1]){
    b.box([.7,BELL_TOP-BELL_BASE,.7],[cx+dx*bhw,(BELL_BASE+BELL_TOP)/2,cz+dz*bhw],"marble",T.bell(23),{shade:1.03,duration:.03,lift:1});
    colonnette(b,[cx+dx*(bhw+.2),BELL_BASE,cz+dz*(bhw-.55)],BELL_TOP-BELL_BASE-.1,.17,.585);
    colonnette(b,[cx+dx*(bhw-.55),BELL_BASE,cz+dz*(bhw+.2)],BELL_TOP-BELL_BASE-.1,.17,.585);
  }
  b.box([.3,.3,bhw*2-.5],[cx,BELL_TOP-.55,cz],"wood",.60);
  b.cylinder(.02,.02,.5,[cx,BELL_TOP-1.05,cz],"iron",.605);
  b.cylinder(.34,.58,.75,[cx,BELL_TOP-1.65,cz],"gold",.607,{shade:.85});
  b.sphere([cx,BELL_TOP-2.08,cz],[.1,.1,.1],"gold",.609);
  cornice(b,bell,BELL_TOP,.61);
  // Balustrade with corner pedestals and angels on the two front corners.
  const rhw=2.65;
  for(const f of square(rhw))balustrade(b,f,DRUM_BASE+.04,.63,.85);
  for(const dx of[-1,1])for(const dz of[-1,1]){
    b.box([.55,1.15,.55],[cx+dx*rhw,DRUM_BASE+.6,cz+dz*rhw],"marble",.63,{shade:1.02});
    if(dz>0)angel(b,[cx+dx*rhw,DRUM_BASE+1.17,cz+dz*rhw],0,.955,.8);
  }
  // Round tempietto: stepped plinth, closed core, eight pink colonnettes, entablature ring.
  b.cylinder(2.05,2.15,.3,[cx,DRUM_BASE+.15,cz],"marble",.64,{shade:1.02,duration:.02,lift:1});
  b.cylinder(1.25,1.25,TEMPIETTO_H,[cx,DRUM_BASE+.3+TEMPIETTO_H/2,cz],"marble",.65,{shade:.94,duration:.03,lift:1.5});
  for(let i=0;i<8;i++){const a=i*Math.PI/4+Math.PI/8;colonnette(b,[cx+Math.sin(a)*1.72,DRUM_BASE+.3,cz+Math.cos(a)*1.72],TEMPIETTO_H,.17,.66+i*.005);}
  const entY=DRUM_BASE+.3+TEMPIETTO_H;
  b.cylinder(2.05,2.05,.4,[cx,entY+.2,cz],"marble",.71,{shade:.98,duration:.02,lift:.8});
  b.cylinder(2.3,2.1,.25,[cx,entY+.525,cz],"marble",.715,{shade:1.03,duration:.02,lift:.8});
  // Dome in eight segments with stone ribs, then orb and slender pinnacle.
  const profile:THREE.Vector2[]=[];
  for(let k=0;k<=14;k++){const t=k/14;profile.push(new THREE.Vector2(2.0*Math.pow(Math.cos(t*Math.PI/2),.9)*(1+.07*Math.sin(t*Math.PI))+.002,t*2.4));}
  for(let i=0;i<8;i++){const g=new THREE.LatheGeometry(profile,4,i*Math.PI/4,Math.PI/4);b.add(g,"marble",.72+i*.007,{p:[cx,DOME_BASE,cz],shade:.97,duration:.02,lift:1.2});g.dispose();}
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4,pts:Point[]=[];
    for(let k=0;k<=8;k++){const t=k/8,r=2.0*Math.pow(Math.cos(t*Math.PI/2),.9)*(1+.07*Math.sin(t*Math.PI))+.03;pts.push([cx+Math.sin(a)*r,DOME_BASE+t*2.4,cz+Math.cos(a)*r]);}
    b.tube(pts,.06,"stone",.78+i*.002,{shade:.9},10);
  }
  const top=DOME_BASE+2.4;
  b.cylinder(.32,.4,.25,[cx,top+.12,cz],"marble",.80,{shade:1.02});
  b.sphere([cx,top+.42,cz],[.22,.22,.22],"marble",.805,{shade:1.05});
  b.cylinder(.035,.06,1.9,[cx,top+1.5,cz],"iron",.81,{duration:.01,lift:.6});
  b.sphere([cx,top+2.5,cz],[.11,.11,.11],"gold",.82);
  b.cylinder(.012,.025,.6,[cx,top+2.85,cz],"iron",.822,{duration:.01,lift:.4});
}
function annex(b:HeritageBuilder){
  // Lower chapel wing on the left flank: three visible walls, its own gable roof, arched windows.
  const outer=new Wall([-ANNEX_X,0,ANNEX_Z0],[-ANNEX_X,0,ANNEX_Z1]);
  const front=new Wall([-ANNEX_X,0,ANNEX_Z1],[-WALL_X,0,ANNEX_Z1]);
  const rear=new Wall([-WALL_X,0,ANNEX_Z0],[-ANNEX_X,0,ANNEX_Z0]);
  const ridgeX=-(ANNEX_X+WALL_X)/2,halfSpan=(ANNEX_X-WALL_X)/2+.5,eaveY=ANNEX_TOP+.72-.15,ridgeY=eaveY+halfSpan*.42;
  const gable=(w:Wall)=>(y:number):[number,number]|null=>{
    if(y<ANNEX_TOP)return[0,w.len];
    const hw=Math.max(0,(halfSpan-.4)*(1-(y-eaveY)/(ridgeY-eaveY)));if(hw<.3)return null;
    const c=w.len/2;return[c-hw,c+hw];
  };
  const zs=[-10,-6,-2,2,6,10];
  courses(b,outer,{y0:0,y1:PLINTH,course:.4,block:1.3,material:()=>"stone",start:T.mason,shade:.9});
  courses(b,outer,{y0:PLINTH,y1:ANNEX_TOP,voids:zs.map(z=>arch(z-ANNEX_Z0,1.3,2.8,6.4)),material:()=>"marble",start:T.mason});
  for(const z of zs)archWindow(b,outer,z-ANNEX_Z0,1.3,2.8,6.4,.30);
  for(const z of[-12,-8,-4,0,4,8,12])for(let k=0;k<3;k++){const y=PLINTH+1.2+k*2.4;b.box([.6,2.35,.3],outer.at(z-ANNEX_Z0,y,.28),"marble",T.mason(y),{r:outer.rot(),shade:1.03});}
  for(const w of[front,rear]){
    courses(b,w,{y0:0,y1:PLINTH,course:.4,block:1.3,material:()=>"stone",start:T.mason,shade:.9});
    courses(b,w,{y0:PLINTH,y1:ridgeY-.2,extent:gable(w),material:()=>"marble",start:T.mason});
  }
  cornice(b,[outer,front,rear],ANNEX_TOP,.25,.8);
  gableRoof(b,ridgeX,halfSpan,eaveY,ridgeY,ANNEX_Z0-.4,ANNEX_Z1+.4,3,.30,false);
  // Arcaded gallery in front of the wing, flat roof with a parapet.
  const gFront=new Wall([-GALLERY_X,0,GALLERY_Z],[-WALL_X-.75,0,GALLERY_Z]);
  const gOuter=new Wall([-GALLERY_X,0,ANNEX_Z1],[-GALLERY_X,0,GALLERY_Z]);
  const arcades:[Wall,number[]][]=[[gFront,[1.3,3.7]],[gOuter,[1.6,3.9,6.2,8.4]]];
  for(const [w,ss]of arcades){
    courses(b,w,{y0:0,y1:PLINTH,course:.4,block:1.3,material:()=>"stone",start:T.mason,shade:.9});
    courses(b,w,{y0:PLINTH,y1:GALLERY_TOP,block:.8,voids:ss.map(s=>arch(s,1.4,PLINTH,4.6)),material:()=>"marble",start:T.mason});
    for(const s of ss)archRing(b,w,s,4.6-.7,.71,.92,.7,.04,"marble",.19);
  }
  b.box([GALLERY_X-WALL_X+.3,.45,GALLERY_Z-ANNEX_Z1+.3],[-(GALLERY_X+WALL_X)/2+.1,GALLERY_TOP+.225,(GALLERY_Z+ANNEX_Z1)/2],"marble",.21,{duration:.02,lift:.8,shade:.98});
  cornice(b,[gFront,gOuter],GALLERY_TOP-.05,.20,.7);
  balustrade(b,new Wall([-GALLERY_X-.2,0,GALLERY_Z+.2],[-WALL_X-.7,0,GALLERY_Z+.2]),GALLERY_TOP+.45,.23,.8);
  balustrade(b,new Wall([-GALLERY_X-.2,0,ANNEX_Z1-.2],[-GALLERY_X-.2,0,GALLERY_Z+.2]),GALLERY_TOP+.45,.23,.8);
}

export function buildArchitecture(b:HeritageBuilder){
  // Structural floor decks first: nothing above stands on air.
  b.box([22.4,1.15,40.6],[0,.575,0],"stone",.02,{lift:.4,duration:.03,shade:.95});
  b.box([12.6,1.15,4.4],[0,.575,22.2],"stone",.03,{lift:.4,duration:.03,shade:.95});
  b.cylinder(6,6,1.15,[0,.575,REAR],"stone",.02,{lift:.4,duration:.03,shade:.95});
  b.box([ANNEX_X-WALL_X+.4,1.15,ANNEX_Z1-ANNEX_Z0],[-(ANNEX_X+WALL_X)/2,.575,(ANNEX_Z0+ANNEX_Z1)/2],"stone",.02,{lift:.4,duration:.03,shade:.95});
  b.box([GALLERY_X-WALL_X,1.15,GALLERY_Z-ANNEX_Z1],[-(GALLERY_X+WALL_X)/2,.575,(GALLERY_Z+ANNEX_Z1)/2],"stone",.02,{lift:.4,duration:.03,shade:.95});
  colonnade(b);
  sideWalls(b);
  rearAndApse(b);
  facade(b);
  portico(b);
  mainRoof(b);
  annex(b);
  for(const sign of[-1,1])tower(b,sign);
}
