import * as THREE from "three";
import { HeritageBuilder, type Point } from "./builder";
import type { SurfaceName } from "./materials";

// Basílica Santuário de Nossa Senhora de Nazaré (Belém, PA) — a stylised
// neoclassical miniature: flat-roofed side aisles, a narrow set-back clerestory under
// the tiled gable roof, a full-width rear cross gable and an elevated semicircular bay,
// twin bell towers crowned by round colonnaded tempietti and domes, a pink-granite
// portico and a gilded pediment. Scene units (≈1.1 m); about 37 units tall.

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
// Proportions measured on the satellite view: 24 m wide, five naves (the tiled
// roof covers only the central one), a full-width rear transept and a shallow
// lower rear block carrying the semicircular upper bay. One unit ≈ 1.1 m.
const PLINTH=1.2, AISLE_TOP=9.6, WALL_TOP=16.5, PED_BASE=17.22, PED_APEX=19.8;
const AISLE_X=11, CLER_X=5.2, FRONT=20, TRANSEPT_Z0=-12.4, TRANSEPT_Z1=-20.4, REAR=-23.6, APSE_R=3.2;
const EAVE_X=5.8, EAVE_Y=17.05, RIDGE=EAVE_Y+EAVE_X*.42;
const REAR_DECK=AISLE_TOP+.72, APSE_TOP=14.0, CROSS_Z=(TRANSEPT_Z0+TRANSEPT_Z1)/2;
const TOWER_X=8.95, TOWER_Z=19.6, TOWER_HW=2.8, SHAFT_TOP=22.5, BELL_BASE=23.3, BELL_TOP=27.4, DRUM_BASE=28.15;
const TEMPIETTO_H=2.6, DOME_BASE=DRUM_BASE+.3+TEMPIETTO_H+.65;
const FRONT_S=(x:number)=>x+6.15;
const gableHalfWidth=(y:number)=>y<EAVE_Y?CLER_X:Math.min(CLER_X,EAVE_X*(1-(y-EAVE_Y)/(RIDGE-EAVE_Y))-.2);
const pedimentHalfWidth=(y:number)=>6.15*(1-(y-PED_BASE)/(PED_APEX-PED_BASE));
const bays=(z0:number,z1:number,step=4)=>{const out:number[]=[];for(let z=z0;z>=z1-1e-6;z-=step)out.push(z);return out;};

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
        const patina=.98+.025*Math.sin(s*.38+yc*.19)+.012*Math.cos(s*.81-yc*.27);
        b.masonry([Math.max(.08,snap(width)-.02),snap(h,.01)-.015,thick],w.at(s+width/2,yc,out),material,spec.start(yc)+(s/w.len)*.004,
          {r:w.rot(),shade:(spec.shade??1)*tone*patina,lift:spec.lift??.3,duration:.01});
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
  for(const dx of[-1,1])for(const dy of[.27,.71]){
    const x=s+dx*width*.24,y=yb+h*dy,pw=width*.33,ph=h*.3;
    b.box([pw,ph,.055],w.at(x,y,-.018),"wood",start+.006,{r:w.rot(),shade:.79});
    for(const sign of[-1,1]){
      b.box([.045,ph+.09,.06],w.at(x+sign*pw/2,y,.018),"wood",start+.007,{r:w.rot(),shade:1.14});
      b.box([pw+.06,.045,.06],w.at(x,y+sign*ph/2,.018),"wood",start+.007,{r:w.rot(),shade:1.14});
    }
  }
  for(const sign of[-1,1]){
    const x=s+sign*width*.09,y=yb+h*.49;
    b.box([.09,.23,.035],w.at(x,y,.005),"iron",start+.008,{r:w.rot()});
    const knocker=b.geo("door-knocker",()=>new THREE.TorusGeometry(.065,.012,5,12));
    b.add(knocker,"gold",start+.009,{p:w.at(x,y-.025,.044),r:w.rot(),lift:.15});
    for(const dy of[.15,.85])b.box([width*.19,.035,.04],w.at(s+sign*width*.38,yb+h*dy,.002),"iron",start+.008,{r:w.rot()});
  }
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
  const leaf=b.geo("acanthus-leaf",()=>{
    const outline=new THREE.Shape();outline.moveTo(0,0);
    for(const [x,y]of[[-.11,.05],[-.16,.14],[-.1,.14],[-.19,.26],[-.12,.25],[-.14,.35],[-.06,.33],[0,.48],[.06,.33],[.14,.35],[.12,.25],[.19,.26],[.1,.14],[.16,.14],[.11,.05]])outline.lineTo(x,y);
    outline.closePath();
    const g=new THREE.ExtrudeGeometry(outline,{depth:.035,bevelEnabled:false,steps:1});
    const pos=g.getAttribute("position");for(let i=0;i<pos.count;i++)pos.setZ(i,pos.getZ(i)+Math.pow(pos.getY(i)/.48,3)*.16);
    g.computeVertexNormals();return g;
  });
  for(let tier=0;tier<2;tier++)for(let i=0;i<8;i++){
    const a=(i+tier*.5)*TAU/8,rad=r*(tier?1.01:.9);
    b.add(leaf,"marble",start+.031+tier*.002,{p:[p[0]+Math.sin(a)*rad,top+.04+tier*.14,p[2]+Math.cos(a)*rad],r:[0,a,0],s:[r/.36,tier?.8:.85,1],shade:tier?1.04:.93,lift:.2});
  }
  for(let i=0;i<4;i++){
    const a=i*Math.PI/2+Math.PI/4,pts:Point[]=[];
    for(let k=0;k<=12;k++){
      const t=k/12,th=t*TAU*1.1,rr=r*.3*(1-t*.8),q=facePoint(Math.cos(th)*rr,0,0,a);
      pts.push([p[0]+Math.sin(a)*r*1.2+q[0],top+.48+Math.sin(th)*rr,p[2]+Math.cos(a)*r*1.2+q[2]]);
    }
    b.tube(pts,r*.07,"marble",start+.034,{lift:.2},12);
  }
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
function latticeParapet(b:HeritageBuilder,w:Wall,y:number,start:number){
  const h=.9,step=.48,diagonal=Math.hypot(step,h-.23),tilt=Math.atan2(h-.23,step);
  b.box([w.len+.3,.12,.3],w.at(w.len/2,y+.06),"marble",start,{r:w.rot(),shade:.96});
  b.box([w.len+.3,.15,.34],w.at(w.len/2,y+h),"marble",start+.01,{r:w.rot(),shade:1.02});
  for(let s=.14;s+step<w.len-.1;s+=step){
    const center=w.at(s+step/2,y+h/2,.06);
    for(const direction of[-1,1])b.box([diagonal,.055,.08],center,"marble",start+.006,{r:w.rot(direction*tilt),shade:.98});
  }
}
function angel(b:HeritageBuilder,p:Point,yaw:number,start:number,scale=1,wings=true){
  const P=(x:number,y:number,z:number):Point=>{const q=facePoint(x*scale,y*scale,z*scale,yaw);return[p[0]+q[0],p[1]+q[1],p[2]+q[2]];};
  const pose={p,r:[0,yaw,0] as Point,s:[scale,scale,scale] as Point,lift:.18};
  b.box([.7*scale,.28*scale,.64*scale],P(0,.14,0),"marble",start,{shade:.94,r:[0,yaw,0],lift:.18});
  b.box([.76*scale,.08*scale,.7*scale],P(0,.32,0),"marble",start+.002,{r:[0,yaw,0],lift:.18});
  const robe=b.geo("sculpture-robe",()=>surfaceGrid(20,7,(u,v)=>{
    const a=u*TAU,r=(.3-.14*v)*(1+.1*Math.cos(a*10+v*.8));
    return[Math.sin(a)*r,.36+v*.94,Math.cos(a)*r*.66];
  },true));
  b.add(robe,"marble",start+.004,{...pose,shade:.98});
  b.sphere(P(0,1.27,0),[.19*scale,.19*scale,.13*scale],"marble",start+.006,{r:[0,yaw,0],lift:.18});
  b.cylinder(.06*scale,.075*scale,.17*scale,P(0,1.44,0),"marble",start+.007,{lift:.18});
  b.sphere(P(0,1.59,.01),[.115*scale,.145*scale,.11*scale],"marble",start+.009,{r:[0,yaw,0],lift:.18});
  b.sphere(P(0,1.66,-.025),[.125*scale,.1*scale,.105*scale],"marble",start+.01,{r:[0,yaw,0],shade:.88,lift:.18});
  b.sphere(P(0,1.585,.116),[.025*scale,.034*scale,.033*scale],"marble",start+.01,{r:[0,yaw,0],lift:.18});
  for(const sign of[-1,1]){
    b.tube([P(sign*.16,1.32,0),P(sign*.27,1.15,.1),P(sign*.07,1.23,.22)],.064*scale,"marble",start+.011,{lift:.18},5);
    b.sphere(P(sign*.056,1.24,.22),[.046*scale,.07*scale,.043*scale],"marble",start+.012,{r:[0,yaw,sign*.25],lift:.18});
    b.sphere(P(sign*.13,.38,.14),[.07*scale,.045*scale,.13*scale],"marble",start+.005,{r:[0,yaw,0],lift:.18});
    if(!wings)continue;
    const wing=b.geo(`sculpture-wing:${sign}`,()=>{
      const shape=new THREE.Shape();shape.moveTo(sign*.13,1.22);
      shape.bezierCurveTo(sign*.13,1.56,sign*.48,1.91,sign*.64,1.92);
      shape.bezierCurveTo(sign*.62,1.57,sign*.46,1.16,sign*.2,.96);
      shape.quadraticCurveTo(sign*.25,1.13,sign*.13,1.22);
      const g=new THREE.ExtrudeGeometry(shape,{depth:.065,bevelEnabled:true,bevelSize:.015,bevelThickness:.015,bevelSegments:1,steps:1,curveSegments:5});g.translate(0,0,-.14);return g;
    });
    b.add(wing,"marble",start+.013,{...pose,shade:1.04});
    for(let i=0;i<5;i++)b.tube([P(sign*.2,1.21,-.058),P(sign*(.31+i*.035),1.34+i*.056,-.047),P(sign*(.36+i*.057),1.35+i*.116,-.066)],.017*scale,"marble",start+.014,{shade:.86,lift:.18},4);
  }
}

// Roman capitals built as shallow solid strokes.
const LETTERS:Record<string,number[][]>={
  A:[[0,0,.3,1,.6,0],[.13,.4,.47,.4]], D:[[0,0,0,1,.3,1,.55,.82,.6,.5,.55,.18,.3,0,0,0]],
  C:[[.6,.82,.45,1,.17,1,0,.78,0,.22,.17,0,.45,0,.6,.18]],
  E:[[.6,1,0,1,0,0,.6,0],[0,.52,.46,.52]], G:[[.59,.83,.45,1,.17,1,0,.77,0,.22,.17,0,.5,0,.6,.18,.6,.47,.34,.47]],
  H:[[0,0,0,1],[.6,0,.6,1],[0,.5,.6,.5]], I:[[.3,0,.3,1]],
  L:[[0,1,0,0,.6,0]], M:[[0,0,0,1,.3,.42,.6,1,.6,0]], N:[[0,0,0,1,.6,0,.6,1]],
  O:[[.15,0,0,.2,0,.8,.15,1,.45,1,.6,.8,.6,.2,.45,0,.15,0]],
  P:[[0,0,0,1,.42,1,.6,.84,.6,.66,.42,.51,0,.51]],
  R:[[0,0,0,1,.42,1,.6,.84,.6,.66,.42,.51,0,.51],[.3,.51,.64,0]],
  S:[[.59,.85,.44,1,.16,1,0,.83,0,.66,.15,.54,.46,.45,.6,.3,.6,.17,.44,0,.15,0,0,.15]],
  T:[[0,1,.6,1],[.3,1,.3,0]], V:[[0,1,.3,0,.6,1]], Z:[[0,1,.6,1,0,0,.6,0]],
};
function inscription(b:HeritageBuilder,w:Wall,text:string,y:number,width:number,height:number,out:number,start:number,material:SurfaceName="gold"){
  const advance=.83,total=text.length*advance-.23,unit=width/total;
  for(let i=0;i<text.length;i++){
    const letter=text[i];if(letter===' ')continue;
    const g=b.geo(`capital:${letter}`,()=>{
      const shapes:THREE.Shape[]=[];
      const stroke=(x:number,y:number,xx:number,yy:number,thick:number)=>{
        const len=Math.hypot(xx-x,yy-y),nx=-(yy-y)/len*thick/2,ny=(xx-x)/len*thick/2;
        const shape=new THREE.Shape();shape.moveTo(x+nx,y+ny);shape.lineTo(xx+nx,yy+ny);shape.lineTo(xx-nx,yy-ny);shape.lineTo(x-nx,y-ny);shape.closePath();shapes.push(shape);
      };
      for(const path of LETTERS[letter]){
        for(let k=0;k<path.length-2;k+=2)stroke(path[k],path[k+1],path[k+2],path[k+3],.065);
        for(const k of[0,path.length-2])if(path[k+1]===0||path[k+1]===1)stroke(path[k]-.095,path[k+1],path[k]+.095,path[k+1],.04);
      }
      return new THREE.ExtrudeGeometry(shapes,{depth:.07,bevelEnabled:false,steps:1,curveSegments:1});
    });
    b.add(g,material,start+i*.00008,{p:w.at(w.len/2+(i*advance-total/2)*unit,y-height/2,out),r:w.rot(),s:[unit,height,height],lift:.1});
  }
}
function panelFrame(b:HeritageBuilder,w:Wall,s:number,y:number,width:number,height:number,start:number){
  for(const sign of[-1,1]){
    b.box([.045,height,.035],w.at(s+sign*width/2,y,.355),"gold",start,{r:w.rot(),lift:.12});
    b.box([width,.045,.035],w.at(s,y+sign*height/2,.355),"gold",start,{r:w.rot(),lift:.12});
  }
}
function tympanum(b:HeritageBuilder,w:Wall){
  const start=.915,base=PED_BASE+.13;
  // A restrained coloured tessera field gives the triangular tympanum its painted character.
  const sky=["#d9a03c","#eac45c","#f2d780","#c88836"],water=["#286982","#357d8d","#4b97a4","#385e70"];
  const foliage=["#426a48","#6c814c","#8f8e53","#a9794b"],robes=["#923f3d","#315778","#7d5b80","#b77b4d"];
  for(let row=0;row<17;row++){
    const y=base+.07+row*.135,t=(y-base)/(PED_APEX-base),hw=pedimentHalfWidth(y+.07)-.3;
    for(let x=-hw+.08;x<hw-.06;x+=.14){
      const pick=Math.floor(variation(row*71+Math.round(x*100))*4);
      let colour=t<.3?water[pick]:sky[pick];
      if(Math.abs(x)>2.5&&t<.53)colour=foliage[pick];
      for(const [index,cx]of[-3,-1.7,1.7,3].entries())if(Math.abs(x-cx)<.28&&t<.53)colour=robes[(index+pick)%4];
      if(Math.abs(x)<.4&&t>.2&&t<.75)colour=pick%3===0?"#c8d7d0":"#237ba1";
      if(Math.abs(x)<.2&&t>.67&&t<.82)colour="#efdfb1";
      const tint=new THREE.Color(colour);
      b.box([.132,.126,.026],w.at(FRONT_S(x),y,.185),"mosaic",start+row*.0007,{tint:[tint.r,tint.g,tint.b],lift:.1});
    }
  }
  const cy=18.38;
  const halo=b.geo("mandorla",()=>new THREE.TorusGeometry(1,.035,5,32));
  b.add(halo,"gold",.933,{p:w.at(FRONT_S(0),cy,.24),s:[.52,.82,1],shade:1.12,lift:.1});
  for(let k=0;k<24;k++){
    const a=k/24*TAU,dx=Math.sin(a),dy=Math.cos(a),len=k%2?.16:.24;
    b.box([.025,len,.035],w.at(FRONT_S(dx*.7),cy+dy*.92,.23),"gold",.934,{r:w.rot(-a),shade:1.14,lift:.1});
  }
  angel(b,w.at(FRONT_S(0),base,.23),0,.935,.83,false);
  const crown=new THREE.Shape();crown.moveTo(-.13,0);crown.lineTo(-.17,.17);crown.lineTo(-.055,.11);crown.lineTo(0,.23);crown.lineTo(.055,.11);crown.lineTo(.17,.17);crown.lineTo(.13,0);crown.closePath();
  const g=new THREE.ExtrudeGeometry(crown,{depth:.05,bevelEnabled:false});
  b.add(g,"gold",.954,{p:w.at(FRONT_S(0),base+1.72*.83,.25),lift:.1});g.dispose();
  for(const sign of[-1,1]){
    for(let i=0;i<5;i++)b.sphere(w.at(FRONT_S(sign*(.2+i*.19)),base+.06+Math.sin(i*.9)*.05,.23),[.19,.085,.07],"marble",.94,{lift:.1});
    b.tube([w.at(FRONT_S(sign*1.3),base+.08,.22),w.at(FRONT_S(sign*2.6),base+.2,.22),w.at(FRONT_S(sign*3.9),base+.04,.22)],.025,"gold",.94,{lift:.1},8);
    for(let i=0;i<7;i++)b.sphere(w.at(FRONT_S(sign*(1.45+i*.34)),base+.15,.23),[.16,.055,.03],"gold",.945,{r:w.rot(sign*.48),shade:1.08,lift:.1});
  }
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
      const seed=i*13+j*47+start*1000,tone=.94+.035*Math.sin(i*.17+j*.4)+.025*Math.cos(i*.31-j*.16);
      const g=surfaceGrid(5,1,(u,v)=>{const th=(1-u)*Math.PI;const p=at(x+Math.cos(th)*.15,v0+(v1-v0)*v,.03+Math.sin(th)*.11);return[p.x,p.y,p.z];},flip);
      b.add(g,"tile",start+.01+j*.0045+i*.0001,{shade:tone+variation(seed)*.025,tint:[1,.98,.96],duration:.012,lift:.25});g.dispose();
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
  b.box([70,.4,100],[0,-.42,-2],"stone",-1,{lift:0,shade:.9});
  for(let i=-11;i<=11;i++)for(let j=-16;j<=13;j++){
    const x=i*3,z=j*3;
    if(Math.abs(x)<12.5&&z>-29&&z<24.5)continue;
    b.box([2.92,.08,2.92],[x,-.1+(variation(i*7+j*13)-.5)*.01,z],"stone",-1,{lift:0,shade:(i+j)%2?.84:1});
  }
  for(let i=0;i<5;i++)b.box([15-i*.3,.24,.92],[0,.12+i*.24,24.85+(4-i)*.9],"stone",.004+i*.002,{lift:.2,shade:1.06});
  for(let x=-14;x<=14;x+=2){if(Math.abs(x)<3)continue;b.box([.18,1.3,.18],[x,.65,31],"iron",-1,{lift:0});b.sphere([x,1.36,31],[.11,.11,.11],"iron",-1,{lift:0});}
  for(const sign of[-1,1])for(const y of[.55,1.15])b.box([11.2,.06,.06],[sign*8.5,y,31],"iron",-1,{lift:0});
  for(let x=-13.5;x<=13.5;x+=.5){if(Math.abs(x)<3)continue;b.box([.04,1.05,.04],[x,.6,31],"iron",-1,{lift:0});}
  const ribbonColors=["#e63946","#f4c430","#159b70","#2389c9","#8b5cc7","#f17c35","#f4e9d2","#e85d9e"];
  for(let i=0;i<148;i++){
    const x=-14.35+i*.195;
    if(Math.abs(x)<3.05)continue;
    const seed=(i*73+19)%101/101;
    const length=.46+seed*.82,width=.035+((i*29)%7)*.007;
    const sway=Math.sin(i*2.17)*(.035+seed*.055),flutter=Math.sin(i*1.31)*.12;
    const top=1.05+(i%5)*.018,bottom=Math.max(.08,top-length);
    const geometry=new THREE.BufferGeometry();
    const positions=new Float32Array([
      x-width/2,top,30.91,
      x+width/2,top,30.91,
      x-width/2+sway+flutter,bottom+length*.28,30.84,
      x+width/2+sway+flutter,bottom+length*.28,30.84,
      x-width/2+sway,bottom,30.9,
      x+width/2+sway,bottom,30.9,
    ]);
    geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));
    geometry.setIndex([0,1,2,1,3,2,2,3,4,3,5,4]);geometry.computeVertexNormals();
    const color=new THREE.Color(ribbonColors[i%ribbonColors.length]);
    b.add(geometry,"ribbon",-1,{lift:0,tint:[color.r,color.g,color.b],shade:.96});geometry.dispose();
  }
  for(let i=0;i<8;i++)palm(b,17.5,-24+i*6.2,8.5+variation(i)*2,i);
  for(let i=0;i<8;i++)palm(b,-17.5,-24+i*6.2,8+variation(i+9)*2.5,i+9);
  for(const sign of[-1,1]){
    const x=sign*9.5,z=29.5;
    b.cylinder(.22,.28,.28,[x,.08,z],"stone",-1,{lift:0});
    b.cylinder(.07,.12,3.5,[x,1.9,z],"iron",-1,{lift:0});
    b.cylinder(.26,.19,.12,[x,3.68,z],"iron",-1,{lift:0});
    b.box([.34,.48,.34],[x,3.98,z],"glass",-1,{lift:0});
    for(const dx of[-1,1])for(const dz of[-1,1])b.box([.035,.55,.035],[x+dx*.2,3.99,z+dz*.2],"iron",-1,{lift:0});
    b.cylinder(0,.37,.28,[x,4.39,z],"iron",-1,{lift:0});
    b.sphere([x,4.57,z],[.06,.08,.06],"gold",-1,{lift:0});
    for(const bz of[14,-4]){
      const bx=sign*21;
      for(const dx of[-.95,.95]){
        b.box([.13,.68,.6],[bx+dx,.25,bz],"iron",-1,{lift:0});
        b.box([.1,.7,.12],[bx+dx,.77,bz-.29],"iron",-1,{lift:0});
      }
      for(let i=0;i<4;i++)b.box([2.5,.085,.14],[bx,.64,bz-.25+i*.17],"wood",-1,{lift:0,shade:1+i*.035});
      for(let i=0;i<3;i++)b.box([2.5,.14,.075],[bx,.87+i*.19,bz-.32],"wood",-1,{lift:0,shade:1.05});
    }
    for(const pz of[23,-16]){
      const px=sign*21;
      b.box([2.7,.3,2.7],[px,.045,pz],"marble",-1,{lift:0,shade:.9});
      b.box([2.4,.07,2.4],[px,.22,pz],"recess",-1,{lift:0});
      for(let i=0;i<7;i++){const a=i*TAU/7;b.sphere([px+Math.sin(a)*.65,.38,pz+Math.cos(a)*.65],[.52,.22,.5],"moss",-1,{lift:0,shade:.86+variation(i)*.12});}
    }
  }
  // Inlaid stone waves, cut into short tesserae, leave the stair and gate clear.
  for(const z of[33.5,36.5])for(let i=0;i<110;i++){
    const x=-15+i*.275,zz=z+Math.sin(x*.48)*.46,slope=Math.cos(x*.48)*.48*.46;
    b.box([.26,.018,.28],[x,-.047,zz],"marble",-1,{r:[0,-Math.atan(slope),0],shade:1.03,lift:0});
    b.box([.26,.018,.12],[x,-.046,zz+.23],"iron",-1,{r:[0,-Math.atan(slope),0],shade:.85,lift:0});
  }
}

// ---------- Building ----------
function colonnade(b:HeritageBuilder){
  // Interior arcade under the clerestory: the upper walls stand on these, never on air.
  const zs=bays(16,TRANSEPT_Z0+2.4);
  for(const sign of[-1,1]){
    zs.forEach((z,i)=>column(b,[sign*CLER_X,PLINTH,z],7.85,.42,.05+i*.0025));
    b.box([.75,.55,16.8-TRANSEPT_Z0],[sign*CLER_X,9.325,(16.8+TRANSEPT_Z0)/2],"marble",.095,{duration:.02,lift:1,shade:.95});
  }
}
function outerWalls(b:HeritageBuilder){
  // Lower storey on both flanks: aisles with rectangular windows and pilasters; the
  // transept bay keeps rising to a gable; flat aisle roofs with pierced parapets and skylights.
  const zs=bays(14,TRANSEPT_Z0+2.4);
  const transeptRidge=RIDGE,tHalf=(TRANSEPT_Z0-TRANSEPT_Z1)/2,tMid=(TRANSEPT_Z0+TRANSEPT_Z1)/2;
  for(const sign of[-1,1]){
    const w=sign>0?new Wall([AISLE_X,0,16.8],[AISLE_X,0,REAR]):new Wall([-AISLE_X,0,REAR],[-AISLE_X,0,16.8]);
    const sOf=(z:number)=>sign>0?16.8-z:z-REAR;
    const extent=(y:number):[number,number]|null=>{
      if(y<AISLE_TOP)return[0,w.len];
      const a=sOf(TRANSEPT_Z0),c=sOf(TRANSEPT_Z1),lo=Math.min(a,c),hi=Math.max(a,c);
      if(y<WALL_TOP)return[lo,hi];
      const hw=Math.max(0,(tHalf-.2)*(1-(y-EAVE_Y)/(transeptRidge-EAVE_Y)));return hw<.3?null:[(lo+hi)/2-hw,(lo+hi)/2+hw];
    };
    const annexZ=(TRANSEPT_Z1+REAR)/2;
    const voids=[...zs.map(z=>rect(sOf(z),1.4,3.2,7.4)),rect(sOf(tMid),1.4,3.2,7.4),arch(sOf(tMid),1.6,11.9,15.4),arch(sOf(annexZ),1.1,3.6,7.4)];
    courses(b,w,{y0:0,y1:PLINTH,course:.4,block:1.3,material:()=>"stone",start:T.mason,shade:.9});
    courses(b,w,{y0:PLINTH,y1:transeptRidge-.25,voids,extent,material:()=>"marble",start:T.mason});
    for(const z of[...zs,tMid])rectWindow(b,w,sOf(z),1.4,3.2,7.4,.30);
    archWindow(b,w,sOf(tMid),1.6,11.9,15.4,.42);
    archWindow(b,w,sOf(annexZ),1.1,3.6,7.4,.30);
    for(const z of bays(16,TRANSEPT_Z0+2.4))for(let k=0;k<4;k++){const y=PLINTH+1.05+k*2.1;b.box([.7,2.05,.32],w.at(sOf(z),y,.3),"marble",T.mason(y),{r:w.rot(),shade:1.03});}
    for(const z of[TRANSEPT_Z0,TRANSEPT_Z1,REAR])for(let k=0;k<(z===REAR?4:7);k++){const y=PLINTH+1.06+k*2.11;b.box([.75,2.06,.75],[sign*AISLE_X,y,z],"marble",T.mason(y),{shade:1.03});}
    const aisleEdge=sign>0?new Wall([AISLE_X,0,16.8],[AISLE_X,0,TRANSEPT_Z0]):new Wall([-AISLE_X,0,TRANSEPT_Z0],[-AISLE_X,0,16.8]);
    cornice(b,[aisleEdge],AISLE_TOP,.28);
    // Transept faces above the aisle roofs, with the nave cornice.
    const faceF=sign>0?new Wall([CLER_X-.3,0,TRANSEPT_Z0],[AISLE_X,0,TRANSEPT_Z0]):new Wall([-AISLE_X,0,TRANSEPT_Z0],[-CLER_X+.3,0,TRANSEPT_Z0]);
    courses(b,faceF,{y0:AISLE_TOP,y1:WALL_TOP,material:()=>"marble",start:T.mason});
    cornice(b,[faceF],WALL_TOP,.385);
    strip(b,new Wall(w.at(sOf(TRANSEPT_Z0),0),w.at(sOf(TRANSEPT_Z1),0)),WALL_TOP+.36,.6,.25,.7,"marble",.386,1.0);
    // The aisle roof rises from the outer cornice to the clerestory on both sides.
    const z0=16.8,z1=TRANSEPT_Z0,len=z0-z1,zc=(z0+z1)/2;
    const eaveX=AISLE_X+.25,innerX=CLER_X+.08,eaveY=AISLE_TOP+.48,innerY=AISLE_TOP+1.92;
    const span=eaveX-innerX,rise=innerY-eaveY,rake=Math.atan2(rise,span),rakeLen=Math.hypot(span,rise);
    b.box([span+.25,.22,len],[sign*(eaveX+innerX)/2,AISLE_TOP+.14,zc],"stone",.30,{duration:.02,lift:.5,shade:.95});
    for(let z=z1+.8;z<z0;z+=3.8)b.box([rakeLen,.2,.2],[sign*(eaveX+innerX)/2,(eaveY+innerY)/2-.17,z],"wood",.315,{r:[0,0,-sign*rake],duration:.02,lift:.8});
    for(const t of[.22,.64])b.box([.18,.19,len-.3],[sign*(eaveX-span*t),eaveY+rise*t-.16,zc],"wood",.332,{duration:.015,lift:.5});
    if(sign>0)tiledSlope(b,[eaveX,eaveY,z1],[eaveX,eaveY,z0],[-span,rise,0],.345);
    else tiledSlope(b,[-eaveX,eaveY,z0],[-eaveX,eaveY,z1],[span,rise,0],.345);
    for(let row=1;row<10;row++){
      const t=row*.6/rakeLen;
      b.box([.075,.045,len-.1],[sign*(eaveX-span*t),eaveY+rise*t+.11,zc],"tile",.355+row*.0045,{shade:.82+variation(row*17+(sign+1)*5)*.08,lift:.2});
    }
    b.box([rakeLen,.19,.24],[sign*(eaveX+innerX)/2,(eaveY+innerY)/2-.04,z0+.1],"wood",.35,{r:[0,0,-sign*rake],shade:.86});
  }
}
function clerestory(b:HeritageBuilder){
  // Upper storey of the central nave, set back over the flat aisle roofs: arched windows between pilasters.
  const zs=bays(14,TRANSEPT_Z0+2.4);
  for(const sign of[-1,1]){
    for(const [z0,z1,ws]of[[16.8,TRANSEPT_Z0,zs]] as [number,number,number[]][]){
      const w=sign>0?new Wall([CLER_X,0,z0],[CLER_X,0,z1]):new Wall([-CLER_X,0,z1],[-CLER_X,0,z0]);
      const sOf=(z:number)=>sign>0?z0-z:z-z1;
      courses(b,w,{y0:AISLE_TOP,y1:WALL_TOP,voids:ws.map(z=>arch(sOf(z),1.6,11.9,15.4)),material:()=>"marble",start:T.mason});
      for(const z of ws)archWindow(b,w,sOf(z),1.6,11.9,15.4,.42);
      if(ws.length>1)for(const z of bays(16,TRANSEPT_Z0+2.4))for(let k=0;k<2;k++){const y=AISLE_TOP+.72+1.4+k*2.5;b.box([.6,2.45,.3],w.at(sOf(z),y,.3),"marble",T.mason(y),{r:w.rot(),shade:1.03});}
      cornice(b,[w],WALL_TOP,.385);
    }
  }
}
function transeptRoof(b:HeritageBuilder){
  // Cross gable over the transept: ridge across the building, slopes facing front and rear, tiled like the nave.
  const zc=(TRANSEPT_Z0+TRANSEPT_Z1)/2,half=(TRANSEPT_Z0-TRANSEPT_Z1)/2+.4,rise=RIDGE-EAVE_Y;
  const rake=Math.atan2(rise,half),rakeLen=Math.hypot(half,rise),x0=-AISLE_X-.7,x1=AISLE_X+.7;
  for(let x=x0+1;x<x1;x+=2.5){
    b.box([2*half-.6,.3,.28],[x,EAVE_Y-.35,zc],"wood",.40,{r:[0,Math.PI/2,0],duration:.02,lift:2});
    for(const s of[-1,1])b.box([rakeLen,.28,.24],[x,(EAVE_Y+RIDGE)/2-.1,zc+s*half/2],"wood",.404,{r:[0,Math.PI/2,s*rake],duration:.02,lift:2});
  }
  tiledSlope(b,[x0,EAVE_Y,zc+half],[x1,EAVE_Y,zc+half],[0,rise,-half],.455);
  tiledSlope(b,[x1,EAVE_Y,zc-half],[x0,EAVE_Y,zc-half],[0,rise,half],.455);
  for(let x=x0+.1,i=0;x<x1;x+=.64,i++)b.cylinder(.2,.21,.6,[x,RIDGE+.12,zc],"tile",.53+i*.0003,{r:[0,0,Math.PI/2],shade:1+variation(i)*.12});
  for(const sign of[-1,1])for(const s of[-1,1])b.box([rakeLen+.2,.4,.7],[sign*(AISLE_X+.35),(EAVE_Y+RIDGE)/2+.15,zc+s*half/2],"marble",.47,{r:[0,Math.PI/2,s*rake],shade:1.02,duration:.02,lift:.6});
}
function rearDormer(b:HeritageBuilder,p:Point,scale:number,start:number){
  const triangle=new THREE.Shape();triangle.moveTo(-.48,0);triangle.lineTo(.48,0);triangle.lineTo(0,.56);triangle.closePath();
  const hole=new THREE.Path();hole.moveTo(-.29,.07);hole.lineTo(0,.43);hole.lineTo(.29,.07);hole.closePath();triangle.holes.push(hole);
  const g=new THREE.ExtrudeGeometry(triangle,{depth:.65,bevelEnabled:false});
  b.add(g,"marble",start,{p,s:[scale,scale,scale],lift:.2});g.dispose();
  const opening=new THREE.Shape();opening.moveTo(-.29,.07);opening.lineTo(.29,.07);opening.lineTo(0,.43);opening.closePath();
  const pane=new THREE.ShapeGeometry(opening);
  b.add(pane,"recess",start+.004,{p:[p[0],p[1],p[2]+.2*scale],r:[0,Math.PI,0],s:[scale,scale,scale],lift:.2});pane.dispose();
  for(const sign of[-1,1])b.box([.79*scale,.08*scale,.85*scale],[p[0]+sign*.24*scale,p[1]+.31*scale,p[2]+.31*scale],"tile",start+.006,{r:[0,0,-sign*Math.atan2(.56,.48)],lift:.2});
}
function rearAndApse(b:HeritageBuilder){
  // The Maps reference shows a rectangular lower block; the curved bay starts on its deck.
  const back=new Wall([AISLE_X,0,REAR],[-AISLE_X,0,REAR]);
  const rearS=(x:number)=>AISLE_X-x,lowerWindows=[-7.5,-2,2,7.5];
  courses(b,back,{y0:0,y1:PLINTH,course:.4,block:1.3,material:()=>"stone",start:T.mason,shade:.9});
  courses(b,back,{y0:PLINTH,y1:AISLE_TOP,voids:lowerWindows.map(x=>arch(rearS(x),Math.abs(x)>3?1.55:.65,3.6,Math.abs(x)>3?7.5:6.7)),material:()=>"marble",start:T.mason});
  for(const x of lowerWindows)archWindow(b,back,rearS(x),Math.abs(x)>3?1.55:.65,3.6,Math.abs(x)>3?7.5:6.7,.30);
  for(const x of[-AISLE_X,-3.35,3.35,AISLE_X])for(let k=0;k<4;k++){
    const y=PLINTH+1.04+k*2.08;b.box([.54,2.03,.3],back.at(rearS(x),y,.29),"marble",T.mason(y),{r:back.rot(),shade:1.03});
  }
  const sides=[new Wall([AISLE_X,0,TRANSEPT_Z1],[AISLE_X,0,REAR]),new Wall([-AISLE_X,0,REAR],[-AISLE_X,0,TRANSEPT_Z1])];
  cornice(b,[back,...sides],AISLE_TOP,.28);
  const depth=TRANSEPT_Z1-REAR;
  b.box([2*AISLE_X,.28,depth],[0,REAR_DECK-.14,(REAR+TRANSEPT_Z1)/2],"stone",.30,{duration:.018,lift:.3,shade:.98});
  // This full-width wall closes the transept directly beneath its transverse roof.
  const upper=new Wall([AISLE_X,0,TRANSEPT_Z1],[-AISLE_X,0,TRANSEPT_Z1]);
  courses(b,upper,{y0:0,y1:PLINTH,course:.4,block:1.3,material:()=>"stone",start:T.mason,shade:.9});
  courses(b,upper,{y0:PLINTH,y1:WALL_TOP,voids:[-6.8,6.8].map(x=>arch(rearS(x),1.5,11.6,14.9)),material:()=>"marble",start:T.mason});
  for(const x of[-6.8,6.8])archWindow(b,upper,rearS(x),1.5,11.6,14.9,.42);
  cornice(b,[upper],WALL_TOP,.385);
  for(const sign of[-1,1]){
    const lo=sign>0?APSE_R+.28:-AISLE_X+.16,hi=sign>0?AISLE_X-.16:-APSE_R-.28;
    tiledSlope(b,[lo,REAR_DECK+.05,REAR+.08],[hi,REAR_DECK+.05,REAR+.08],[0,.83,depth-.12],.35);
    const edge=new Wall([hi,0,REAR],[lo,0,REAR]);
    courses(b,edge,{y0:REAR_DECK,y1:REAR_DECK+.56,course:.28,block:1.0,thick:.24,material:()=>"marble",start:()=>.37});
    b.box([hi-lo+.2,.13,.38],edge.at(edge.len/2,REAR_DECK+.6),"marble",.386,{r:edge.rot(),lift:.15});
    const side=sides[sign>0?0:1];
    courses(b,side,{y0:REAR_DECK,y1:REAR_DECK+1.12,course:.28,block:.85,thick:.24,extent:y=>{
      const length=depth*Math.max(0,1-(y-REAR_DECK-.44)/.8);return sign>0?[0,Math.min(depth,length)]:[Math.max(0,depth-length),depth];
    },material:()=>"marble",start:()=>.37});
  }
  const faces:Wall[]=[],N=9,half=APSE_R*Math.tan(Math.PI/(2*N)),oculusY=REAR_DECK+1.82,oculusR=.43;
  const assembly=(y:number)=>.335+(y-REAR_DECK)*.016;
  for(let i=0;i<N;i++){
    const th=Math.PI/2+Math.PI/(2*N)+i*Math.PI/N,c=[APSE_R*Math.sin(th),TRANSEPT_Z1+APSE_R*Math.cos(th)],d=[Math.cos(th),-Math.sin(th)];
    const f=new Wall([c[0]-d[0]*half,0,c[1]-d[1]*half],[c[0]+d[0]*half,0,c[1]+d[1]*half]);faces.push(f);
    const windowed=i===2||i===4||i===6;
    courses(b,f,{y0:REAR_DECK,y1:APSE_TOP,block:.8,thick:.48,voids:windowed?[circle(half,oculusY,oculusR)]:[],material:()=>"marble",start:assembly});
    if(windowed){
      const frame=b.geo("rear-oculus",()=>new THREE.TorusGeometry(oculusR+.075,.075,6,24));
      b.add(frame,"marble",.413,{p:f.at(half,oculusY,.25),r:f.rot(),lift:.15});
      const inset=b.geo("rear-oculus-inset",()=>new THREE.CircleGeometry(oculusR,24));
      b.add(inset,"recess",.411,{p:f.at(half,oculusY,-.08),r:f.rot(),shade:1.2,lift:.15});
      b.add(inset,"glass",.416,{p:f.at(half,oculusY,.02),r:f.rot(),lift:.15});
    }
  }
  cornice(b,faces,APSE_TOP,.413,.65);
  const roofY=APSE_TOP+.49,roofR=APSE_R+.2,roofRise=1.25;
  const cone=surfaceGrid(24,4,(u,v)=>{const th=Math.PI/2+u*Math.PI,r=roofR*(1-v);return[r*Math.sin(th),roofY+v*roofRise,TRANSEPT_Z1+r*Math.cos(th)];},true);
  b.add(cone,"tile",.44,{shade:.94,duration:.02,lift:.35});cone.dispose();
  for(let i=0;i<=14;i++){
    const th=Math.PI/2+i*Math.PI/14,pts:Point[]=[];
    for(let k=0;k<=4;k++){const t=k/4,r=roofR*(1-t)+.015;pts.push([r*Math.sin(th),roofY+.045+t*roofRise,TRANSEPT_Z1+r*Math.cos(th)]);}
    b.tube(pts,.065,"tile",.466+i*.0005,{shade:1.06,lift:.15},5);
  }
  rearDormer(b,[0,roofY+roofRise*(1-1.4/roofR)+.02,TRANSEPT_Z1-1.4],.9,.49);
  const rearRoofZ=TRANSEPT_Z1+.8,rearRoofY=EAVE_Y+(RIDGE-EAVE_Y)*(rearRoofZ-(TRANSEPT_Z1-.4))/(CROSS_Z-(TRANSEPT_Z1-.4));
  rearDormer(b,[0,rearRoofY+.04,rearRoofZ],1.4,.58);
}

function mainRoof(b:HeritageBuilder){
  gableRoof(b,0,EAVE_X,EAVE_Y,RIDGE,CROSS_Z,20.7,4,.40);
  // Three triangular dormers per nave slope; the rear roof has its own dormer.
  for(const sign of[-1,1])for(const z of[10.9,3.3,-7.3]){
    const t=.35,x=sign*EAVE_X*(1-t),y=EAVE_Y+(RIDGE-EAVE_Y)*t;
    b.box([.7,.75,1],[x,y+.42,z],"marble",.58,{shade:1.02});
    b.box([.02,.4,.5],[x+sign*.36,y+.42,z],"recess",.584);
    for(const side of[-1,1])b.box([.9,.06,.64],[x,y+.95,z+side*.24],"tile",.586,{r:[side*.7,0,0],shade:.9});
  }
}
function facade(b:HeritageBuilder){
  const w=new Wall([-6.15,0,FRONT],[6.15,0,FRONT]);
  const doors:[number,number,number][]=[[0,2.6,6.6],[-4.42,1.05,5.2],[4.42,1.05,5.2]];
  const voids=[...doors.map(([x,wd,yt])=>arch(FRONT_S(x),wd,PLINTH,yt)),circle(FRONT_S(0),13.6,1.4),arch(FRONT_S(-3.75),1.1,11.6,14.3),arch(FRONT_S(3.75),1.1,11.6,14.3)];
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
  b.box([12.3,.45,.08],w.at(w.len/2,16.05,.34),"gold",.60,{r:w.rot(),shade:1.04});
  inscription(b,w,"DEIPARAE VIRGINI A NAZARETH",16.05,10.8,.3,.39,.88,"iron");
  for(const x of[-5.4,5.4])b.box([.06,5.2,.9],w.at(FRONT_S(x),13.4,.34),"gold",.60,{r:w.rot()});
  tympanum(b,w);
  // Rose window: stone ring, gilded spokes, dark reveal and glazing.
  const ring=new THREE.TorusGeometry(1.5,.16,8,48);b.add(ring,"stone",.62,{p:w.at(FRONT_S(0),13.6,.22),r:w.rot(),shade:.95});ring.dispose();
  for(let k=0;k<24;k++){
    const a=k*TAU/24;
    b.sphere(w.at(FRONT_S(Math.sin(a)*1.63),13.6+Math.cos(a)*1.63,.25),[.065,.065,.045],"marble",.648,{lift:.12});
  }
  const inner=new THREE.TorusGeometry(.5,.06,6,24);b.add(inner,"gold",.63,{p:w.at(FRONT_S(0),13.6,.1),r:w.rot()});inner.dispose();
  for(let k=0;k<12;k++){
    const a=k*TAU/12,pts:Point[]=[];
    for(let i=0;i<=12;i++){
      const th=i/12*TAU,r=.87+.45*Math.cos(th),tangent=.2*Math.sin(th);
      pts.push(w.at(FRONT_S(Math.sin(a)*r+Math.cos(a)*tangent),13.6+Math.cos(a)*r-Math.sin(a)*tangent,.13));
    }
    b.tube(pts,.025,"gold",.632+k*.001,{lift:.12},12);
    b.sphere(w.at(FRONT_S(Math.sin(a)*1.36),13.6+Math.cos(a)*1.36,.15),[.046,.046,.03],"gold",.646,{lift:.12});
  }
  const center=b.geo("rose-quatrefoil",()=>new THREE.TorusGeometry(.2,.032,5,16));
  for(let i=0;i<4;i++){const a=i*Math.PI/2;b.add(center,"gold",.647,{p:w.at(FRONT_S(Math.sin(a)*.17),13.6+Math.cos(a)*.17,.14),r:w.rot(),lift:.12});}
  const reveal=new THREE.CylinderGeometry(1.42,1.42,.06,40);reveal.rotateX(Math.PI/2);b.add(reveal,"recess",.62,{p:w.at(FRONT_S(0),13.6,-.1),r:w.rot()});reveal.dispose();
  const glazing=new THREE.CircleGeometry(1.4,40);b.add(glazing,"glass",.635,{p:w.at(FRONT_S(0),13.6,.02),r:w.rot(),lift:.1});glazing.dispose();
  for(const x of[-3.75,3.75])archWindow(b,w,FRONT_S(x),1.1,11.6,14.3,.45);
  angel(b,[0,10.94,20.85],0,.9,1.42,false);
  for(const [x,wd,yt]of doors)door(b,w,FRONT_S(x),wd,PLINTH,yt,.66);
  for(const x of[-5.9,5.9])angel(b,w.at(FRONT_S(x),PED_BASE,.3),0,.94,1.05);
  cross(b,[0,PED_APEX+.1,FRONT+.35],1.4,.975);
}
function portico(b:HeritageBuilder){
  const w=new Wall([-6.15,0,FRONT],[6.15,0,FRONT]),xs=[-5.35,-1.7,1.7,5.35];
  xs.forEach((x,i)=>{
    column(b,[x,PLINTH,23.4],8.4,.36,.20+i*.008,"granite");
    for(let k=0;k<4;k++){const y=PLINTH+1.05+k*2.1;b.box([.8,2.05,.3],w.at(FRONT_S(x),y,.42),"marble",T.mason(y),{r:w.rot(),shade:1.03});}
  });
  b.box([13,.55,4.1],[0,9.875,22.05],"marble",.30,{duration:.03,lift:1,shade:.98});
  b.box([12.6,.36,.06],[0,9.84,24.14],"gold",.31,{shade:1.02});
  inscription(b,new Wall([-6.3,0,24.14],[6.3,0,24.14]),"SALVE REGINA MATER MISERICORDIAE",9.765,11.7,.25,.035,.88,"iron");
  b.box([13.6,.28,4.6],[0,10.3,22.1],"marble",.32,{duration:.02,lift:.6,shade:1.03});
  for(let x=-6.4;x<=6.4;x+=.45)b.box([.16,.2,.22],[x,10.02,24.3],"marble",.315,{shade:.88});
  // Pierced parapet over the portico.
  latticeParapet(b,new Wall([-6.3,0,24.05],[6.3,0,24.05]),10.5,.34);
  balustrade(b,new Wall([6.55,0,24.05],[6.55,0,20.5]),10.5,.345);
  balustrade(b,new Wall([-6.55,0,20.5],[-6.55,0,24.05]),10.5,.345);
  for(const x of[-6.55,6.55])b.box([.5,1.15,.5],[x,11.05,24.05],"marble",.34,{shade:1.02});
  b.box([2.45,.66,.11],[0,10.96,24.25],"gold",.88,{shade:1.04,lift:.1});
  inscription(b,new Wall([-1.2,0,24.25],[1.2,0,24.25]),"NAZARETH",10.99,1.8,.15,.08,.9,"iron");
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
  const faces=square(hw),outer=sign>0?1:3,clockY=SHAFT_TOP-2.2;
  faces.forEach((f,i)=>{
    const voids:Void[]=[];
    if(i===0)voids.push(arch(hw,1.1,12,14.6),rect(hw,1,4.6,6.9),circle(hw,clockY,1.05));
    if(i===outer)voids.push(arch(hw,1.1,12,14.6),circle(hw,clockY,1.05));
    courses(b,f,{y0:0,y1:PLINTH,course:.4,block:1.3,material:()=>"stone",start:T.mason,shade:.9});
    courses(b,f,{y0:PLINTH,y1:SHAFT_TOP,block:.95,voids,material:banded,start:T.mason});
    if(i===0){archWindow(b,f,hw,1.1,12,14.6,.44);rectWindow(b,f,hw,1,4.6,6.9,.44);}
    if(i===outer)archWindow(b,f,hw,1.1,12,14.6,.44);
    if(i===0||i===outer){
      clock(b,f,hw,clockY,.47);
      b.box([hw*2-.4,.13,.05],f.at(hw,16.05,.34),"gold",.60,{r:f.rot()});
      panelFrame(b,f,hw,13.22,3.6,5.0,.86);
      panelFrame(b,f,hw,clockY,3.6,3.05,.86);
    }
  });
  const segs=5,segH=(SHAFT_TOP-PLINTH)/segs;
  for(const dx of[-1,1])for(const dz of[-1,1])for(let k=0;k<segs;k++){const y=PLINTH+segH/2+k*segH;b.box([.75,segH-.06,.75],[cx+dx*hw,y,cz+dz*hw],"marble",T.mason(y),{shade:1.03});}
  cornice(b,faces,AISLE_TOP,.28,.7);cornice(b,faces,WALL_TOP,.39,.7);cornice(b,faces,SHAFT_TOP,.465,1.1);
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
    b.box([.7,BELL_TOP-BELL_BASE,.7],[cx+dx*bhw,(BELL_BASE+BELL_TOP)/2,cz+dz*bhw],"marble",T.bell((BELL_BASE+BELL_TOP)/2),{shade:1.03,duration:.03,lift:1});
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
  const domeH=2.6,profile:THREE.Vector2[]=[];
  for(let k=0;k<=14;k++){const t=k/14;profile.push(new THREE.Vector2(2.0*Math.pow(Math.cos(t*Math.PI/2),.9)*(1+.07*Math.sin(t*Math.PI))+.002,t*domeH));}
  for(let i=0;i<8;i++){const g=new THREE.LatheGeometry(profile,4,i*Math.PI/4,Math.PI/4);b.add(g,"marble",.72+i*.007,{p:[cx,DOME_BASE,cz],shade:.97,duration:.02,lift:1.2});g.dispose();}
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4,pts:Point[]=[];
    for(let k=0;k<=8;k++){const t=k/8,r=2.0*Math.pow(Math.cos(t*Math.PI/2),.9)*(1+.07*Math.sin(t*Math.PI))+.03;pts.push([cx+Math.sin(a)*r,DOME_BASE+t*domeH,cz+Math.cos(a)*r]);}
    b.tube(pts,.06,"stone",.78+i*.002,{shade:.9},10);
  }
  const top=DOME_BASE+domeH;
  b.cylinder(.32,.4,.25,[cx,top+.12,cz],"marble",.80,{shade:1.02});
  b.sphere([cx,top+.42,cz],[.22,.22,.22],"marble",.805,{shade:1.05});
  b.cylinder(.035,.06,2.1,[cx,top+1.6,cz],"iron",.81,{duration:.01,lift:.6});
  b.sphere([cx,top+2.7,cz],[.11,.11,.11],"gold",.82);
  b.cylinder(.012,.025,.6,[cx,top+3.05,cz],"iron",.822,{duration:.01,lift:.4});
}

export function buildArchitecture(b:HeritageBuilder){
  // Structural floor decks first: nothing above stands on air.
  b.box([2*AISLE_X+.4,1.15,FRONT-REAR+.6],[0,.575,(FRONT+REAR)/2],"stone",.02,{lift:.4,duration:.03,shade:.95});
  b.box([12.6,1.15,4.4],[0,.575,22.2],"stone",.03,{lift:.4,duration:.03,shade:.95});
  colonnade(b);
  outerWalls(b);
  clerestory(b);
  rearAndApse(b);
  facade(b);
  portico(b);
  mainRoof(b);
  transeptRoof(b);
  for(const sign of[-1,1])tower(b,sign);
}
