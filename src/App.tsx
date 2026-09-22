import { useCallback, useEffect, useRef, useState } from "react";
import BasilicaScene, { type DetailView } from "./BasilicaScene";
import { getCopy, locales, type Locale } from "./i18n";
import type { VideoCopy } from "./heritage/export-video";

const DURATION = 14;
const stageEnds = [.1, .14, .4, .5, .64, .86, .995, 1] as const;
const viewIds: DetailView[] = ["overview", "towers", "portico", "rear"];
const cirioUrl = "https://www.ciriodenazare.com.br/cirio/procissoes";
const basilicaUrl = "https://ciriodenazare.com.br/cirio/a-basilica-santuario-de-nazare";

function daysUntilCirio() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Belem",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());
  const part = (type: string) => Number(parts.find((value) => value.type === type)?.value);
  let year = part("year");
  const today = Date.UTC(year, part("month") - 1, part("day"));
  const eventDay = (eventYear: number) => {
    const firstDay = new Date(Date.UTC(eventYear, 9, 1)).getUTCDay();
    const firstSunday = 1 + ((7 - firstDay) % 7);
    return Date.UTC(eventYear, 9, firstSunday + 7);
  };
  let event = eventDay(year);
  if (today > event) event = eventDay(++year);
  return Math.round((event - today) / 86_400_000);
}

type VideoExporter = (copy: VideoCopy, onProgress: (progress: number) => void) => Promise<Blob>;

export default function App() {
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<DetailView>("overview");
  const [locale, setLocale] = useState<Locale>("pt");
  const [infoOpen, setInfoOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [videoError, setVideoError] = useState(false);
  const [cirioDays, setCirioDays] = useState(daysUntilCirio);
  const started = useRef(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoExporter = useRef<VideoExporter | null>(null);
  const t = getCopy(locale);

  const onReady = useCallback(() => {
    started.current = performance.now();
    setReady(true);
  }, []);
  const onVideoExportReady = useCallback((exporter: VideoExporter) => { videoExporter.current = exporter; }, []);

  useEffect(() => {
    document.documentElement.lang = locales.find(({ id }) => id === locale)?.htmlLang ?? "pt-BR";
    document.title = t.pageTitle;
  }, [locale, t.pageTitle]);

  useEffect(() => {
    if (infoOpen && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [infoOpen]);

  useEffect(() => {
    const update = () => setCirioDays(daysUntilCirio());
    const interval = window.setInterval(update, 60_000);
    return () => window.clearInterval(interval);
  }, []);

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

  const downloadVideo = async () => {
    const resumePlayback = playing;
    setVideoError(false);
    setRecording(true);
    setExportProgress(0);
    setPlaying(false);
    try {
      const videoCopy: VideoCopy = {
        brand: "CÍRIO DE NAZARÉ · BELÉM · PARÁ",
        title: t.infoTitle,
        subtitle: `${t.headline[0]} ${t.headline[1]}`,
        stages: t.stages,
      };
      if (!videoExporter.current) throw new Error("Video export is not ready.");
      const blob = await videoExporter.current(videoCopy, setExportProgress);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `basilica-nazare-${locale}-vertical.mp4`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      setVideoError(true);
    } finally {
      started.current = performance.now() - progress * DURATION * 1000;
      setPlaying(resumePlayback);
      setRecording(false);
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
          <a className="cirio-countdown" href={cirioUrl} target="_blank" rel="noreferrer" aria-label={t.cirio(cirioDays)}>
            <span className="countdown-label">{t.cirio(cirioDays)}</span>
          </a>
          <nav className="language-selector" aria-label="Idioma / Language">
            {locales.map(({ id, label }) => (
              <button key={id} aria-pressed={locale === id} onClick={() => setLocale(id)}>{label}</button>
            ))}
          </nav>
          <button className="info-button" aria-label={t.info} title={t.info} onClick={() => setInfoOpen(true)}>i</button>
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
          <BasilicaScene progress={progress} view={view} onReady={onReady} label={t.scene} onVideoExportReady={onVideoExportReady} />
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
        <button className="download-video" disabled={!ready || recording} onClick={downloadVideo} aria-label={t.downloadVideo} title={t.downloadVideo}>
          {recording ? `${Math.round(exportProgress * 100)}%` : <><span aria-hidden="true">↓</span><span className="download-label">{t.downloadVideo}</span></>}
        </button>
      </footer>
      {recording && <div className="video-status" role="status">{exportProgress === 0 ? t.videoPreparing : t.videoExporting} · {Math.round(exportProgress * 100)}%</div>}
      {videoError && <div className="video-status video-error" role="alert">{t.videoError}</div>}
      {infoOpen && (
        <dialog ref={dialogRef} className="info-dialog" onClose={() => setInfoOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
          <button className="dialog-close" aria-label={t.close} onClick={() => dialogRef.current?.close()}>×</button>
          <p className="dialog-eyebrow">{t.anatomy}</p>
          <h2>{t.infoTitle}</h2>
          <p className="dialog-intro">{t.infoIntro}</p>
          <ul>
            <li>{t.infoStyle}</li>
            <li>{t.infoDimensions}</li>
            <li>{t.infoInterior}</li>
          </ul>
          <a className="source-link" href={basilicaUrl} target="_blank" rel="noreferrer">{t.infoSource} ↗</a>
        </dialog>
      )}
    </main>
  );
}
