import { useCallback, useEffect, useRef, useState } from "react";
import BasilicaScene, { type DetailView } from "./BasilicaScene";
import { getCopy, locales, type Locale } from "./i18n";

const DURATION = 14;
const stageEnds = [.1, .14, .4, .5, .64, .86, .995, 1] as const;
const viewIds: DetailView[] = ["overview", "towers", "portico", "rear"];

export default function App() {
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<DetailView>("overview");
  const [locale, setLocale] = useState<Locale>("pt");
  const started = useRef(0);
  const t = getCopy(locale);

  const onReady = useCallback(() => {
    started.current = performance.now();
    setReady(true);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locales.find(({ id }) => id === locale)?.htmlLang ?? "pt-BR";
    document.title = t.pageTitle;
  }, [locale, t.pageTitle]);

  useEffect(() => {
    if (!ready || !playing) return;
    let frame = 0;
    const tick = (now: number) => {
      const next = Math.min(1, (now - started.current) / (DURATION * 1000));
      setProgress(next);
      if (next === 1) setPlaying(false);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ready, playing]);

  const seek = useCallback((value: number) => {
    const next = Math.max(0, Math.min(1, value));
    started.current = performance.now() - next * DURATION * 1000;
    setProgress(next);
  }, []);

  const replay = () => {
    setView("overview");
    seek(0);
    setPlaying(true);
  };
  const toggle = () => {
    seek(progress === 1 ? 0 : progress);
    setPlaying(progress === 1 || !playing);
  };
  const detail = (nextView: DetailView) => {
    setView(nextView);
    if (nextView !== "overview") {
      seek(1);
      setPlaying(false);
    }
  };

  const stageIndex = stageEnds.findIndex((end) => progress < end);
  const stage = t.stages[stageIndex === -1 ? t.stages.length - 1 : stageIndex];

  return (
    <main className="poster">
      <header>
        <span className="wordmark"><i>N</i>Nazaré<em>BELÉM · PARÁ</em></span>
        <small>{t.anatomy}</small>
        <div className="header-actions">
          <nav className="language-selector" aria-label="Idioma / Language">
            {locales.map(({ id, label }) => (
              <button key={id} aria-pressed={locale === id} onClick={() => setLocale(id)}>{label}</button>
            ))}
          </nav>
          <button disabled={!ready} onClick={replay}>{t.rebuild}</button>
        </div>
      </header>

      <section className="scene">
        <aside className="brief">
          <p className="micro">{t.eyebrow}<span>{t.name}</span></p>
          <h2>{t.headline[0]}<br />{t.headline[1]}</h2>
          <p className="accent">{t.accent}</p>
          <blockquote>{t.description.map((line) => <span key={line}>{line}</span>)}</blockquote>
          <div className="index"><b>01</b><i /><span>{t.realtime}</span></div>
        </aside>

        <div className="tower-stage">
          <BasilicaScene progress={progress} view={view} onReady={onReady} label={t.scene} />
          {!ready && <div className="scene-loading">{t.loading}</div>}
          <div className="stage-label"><i />{stage}<span>{Math.round(progress * 100)}%</span></div>
          <div className="view-selector" role="group" aria-label={t.viewpoint}>
            {viewIds.map((id) => (
              <button key={id} disabled={!ready} aria-pressed={view === id} onClick={() => detail(id)}>{t.views[id]}</button>
            ))}
          </div>
          <div className="orbit-hint">{t.orbit}</div>
        </div>

        <aside className="title-block">
          <span className="symbols">{t.period}</span>
          <h1>Ba<br />sí<br />lica</h1>
          <p>{t.materials}</p>
          <div className="original-mark"><b>{t.celebration}</b></div>
        </aside>
      </section>

      <footer>
        <button className="play" disabled={!ready} onClick={toggle} aria-label={playing ? t.pause : t.play}>{playing ? "Ⅱ" : "▶"}</button>
        <div className="timeline">
          <span style={{ width: `${progress * 100}%` }} />
          <input aria-label={t.progress} disabled={!ready} type="range" min="0" max="1000" value={Math.round(progress * 1000)} onChange={(event) => seek(Number(event.target.value) / 1000)} />
        </div>
        <time>{(progress * DURATION).toFixed(1)} / {DURATION} S</time>
      </footer>
    </main>
  );
}
