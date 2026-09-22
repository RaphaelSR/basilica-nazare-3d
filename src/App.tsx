import { useCallback, useEffect, useRef, useState } from 'react';
import BasilicaScene, { type DetailView } from './BasilicaScene';

const DURATION=14;
// Display-only labels; the real timing lives in heritage/architecture.ts.
const stages=[['Embasamento de granito',.10],['Colunata interna',.14],['Alvenaria em fiadas',.40],['Telhado e frontão',.50],['Campanários',.64],['Templetes e cúpulas',.86],['Sinos, relógios e ornamentos',.995],['Basílica concluída',1]] as const;

export default function App(){
  const [progress,setProgress]=useState(0),[playing,setPlaying]=useState(true);
  const [ready,setReady]=useState(false),[view,setView]=useState<DetailView>('overview');
  const started=useRef(0);
  const onReady=useCallback(()=>{started.current=performance.now();setReady(true);},[]);
  useEffect(()=>{
    if(!ready || !playing)return;
    let frame=0;
    const tick=(now:number)=>{
      const next=Math.min(1,(now-started.current)/(DURATION*1000));setProgress(next);
      if(next===1)setPlaying(false);else frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[ready,playing]);
  const seek=useCallback((p:number)=>{const next=Math.max(0,Math.min(1,p));started.current=performance.now()-next*DURATION*1000;setProgress(next);},[]);
  const replay=()=>{setView('overview');seek(0);setPlaying(true);};
  const toggle=()=>{seek(progress===1?0:progress);setPlaying(progress===1 || !playing);};
  const detail=(v:DetailView)=>{setView(v);if(v!=='overview'){seek(1);setPlaying(false);}};
  const stage=stages.find(([,end])=>progress<end)?.[0]??'Basílica concluída';
  return <main className="poster">
    <header><span className="wordmark"><i>N</i>Nazaré<em>BELÉM · PARÁ</em></span><small>ANATOMIA DE UMA CONSTRUÇÃO · 3D</small><div className="header-actions"><button disabled={!ready} onClick={replay}>Reconstruir ↺</button></div></header>
    <section className="scene">
      <aside className="brief"><p className="micro">A ARTE DE ERGUER<br/>Basílica Santuário de Nossa Senhora de Nazaré</p><h2>Pedra sobre pedra,<br/>fé sobre fé.</h2><p className="accent">Uma miniatura em construção contínua.</p><blockquote>Granito no embasamento, colunas coríntias,<br/>naves em fiadas, telhas de barro,<br/>duas torres e o frontão dourado.</blockquote><div className="index"><b>01</b><i/><span>Construção 3D em tempo real</span></div></aside>
      <div className="tower-stage">
        <BasilicaScene progress={progress} view={view} onReady={onReady}/>
        {!ready&&<div className="scene-loading">Erguendo a basílica</div>}
        <div className="stage-label"><i/>{stage}<span>{Math.round(progress*100)}%</span></div>
        <div className="view-selector" role="group" aria-label="Ponto de vista">{([['overview','Vista geral'],['towers','Campanários'],['portico','Pórtico e frontão']] as const).map(([id,label])=><button key={id} disabled={!ready} aria-pressed={view===id} onClick={()=>detail(id)}>{label}</button>)}</div>
        <div className="orbit-hint">ARRASTE PARA ORBITAR · ROLE PARA APROXIMAR</div>
      </div>
      <aside className="title-block"><span className="symbols">NEOCLÁSSICO · 1909</span><h1>Ba<br/>sí<br/>lica</h1><p>GRANITO · MÁRMORE · BARRO</p><div className="original-mark"><b>CÍRIO DE NAZARÉ</b></div></aside>
    </section>
    <footer><button className="play" disabled={!ready} onClick={toggle} aria-label={playing?'Pausar':'Reproduzir'}>{playing?'Ⅱ':'▶'}</button><div className="timeline"><span style={{width:`${progress*100}%`}}/><input aria-label="Progresso da obra" disabled={!ready} type="range" min="0" max="1000" value={Math.round(progress*1000)} onChange={e=>seek(Number(e.target.value)/1000)}/></div><time>{(progress*DURATION).toFixed(1)} / {DURATION} S</time></footer>
  </main>;
}
