"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PaintingCanvas from "@/components/PaintingCanvas";
import StrokeCanvas from "@/components/StrokeCanvas";
import { exportOutlinePNG, exportPaintingPNG } from "@/lib/exportImage";
import { loadImageFile, type LoadedImage } from "@/lib/loadImage";
import { generatePainting } from "@/lib/painterly";
import { generateStrokePlan } from "@/lib/pipeline";
import {
  DETAIL_PRESETS,
  PAINTERLY_PRESETS,
  type DetailLevel,
  type PaintingPlan,
  type RenderMode,
  type StrokePlan,
} from "@/lib/types";
import {
  IconDownload,
  IconImage,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconRestart,
  IconSpark,
  IconUpload,
} from "@/components/icons";

const SPEEDS = [1, 2, 4, 8, 16, 32];
const DETAIL_LEVELS: { value: DetailLevel; label: string }[] = [
  { value: "simple", label: "Simple" },
  { value: "balanced", label: "Balanced" },
  { value: "detailed", label: "Detailed" },
  { value: "fine", label: "Fine" },
  { value: "intricate", label: "Intricate" },
  { value: "extreme", label: "Extreme" },
];
const MODES: { value: RenderMode; label: string }[] = [
  { value: "painterly", label: "Painterly" },
  { value: "outline", label: "Outline" },
];
const MAX_DIMENSION = 460; // load big enough for the most detailed preset

type View =
  | { mode: "outline"; plan: StrokePlan }
  | { mode: "painterly"; plan: PaintingPlan };

export default function Page() {
  const [view, setView] = useState<View | null>(null);
  const [loaded, setLoaded] = useState<LoadedImage | null>(null);
  const [mode, setMode] = useState<RenderMode>("painterly");
  const [detail, setDetail] = useState<DetailLevel>("balanced");
  const [refUrl, setRefUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4); // strokes per second
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showFill, setShowFill] = useState(true);
  const [showGhost, setShowGhost] = useState(true);
  const [narrate, setNarrate] = useState(false);

  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastSpokenRef = useRef<string | null>(null);

  const total = view ? view.plan.strokes.length : 0;

  const buildPlan = useCallback(
    async (img: LoadedImage, m: RenderMode, level: DetailLevel) => {
      setError(null);
      setProcessing(true);
      setPlaying(false);
      setProgress(0);
      try {
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        if (m === "painterly") {
          const plan = generatePainting(
            img.imageData,
            img.sourceWidth,
            img.sourceHeight,
            PAINTERLY_PRESETS[level],
          );
          if (plan.strokes.length === 0) {
            setError("Couldn't derive strokes from that image. Try one with more contrast.");
            setView(null);
          } else {
            setView({ mode: "painterly", plan });
          }
        } else {
          const plan = generateStrokePlan(
            img.imageData,
            img.sourceWidth,
            img.sourceHeight,
            DETAIL_PRESETS[level],
          );
          if (plan.strokes.length === 0) {
            setError("Couldn't find drawable regions in that image. Try one with clearer shapes.");
            setView(null);
          } else {
            setView({ mode: "outline", plan });
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong processing the image.");
      } finally {
        setProcessing(false);
      }
    },
    [],
  );

  const handleFile = useCallback(
    async (file: File) => {
      setProcessing(true);
      setError(null);
      try {
        const img = await loadImageFile(file, MAX_DIMENSION);
        setRefUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return img.url;
        });
        setLoaded(img);
        await buildPlan(img, mode, detail);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load that image.");
        setProcessing(false);
      }
    },
    [buildPlan, mode, detail],
  );

  const changeMode = useCallback(
    (m: RenderMode) => {
      setMode(m);
      if (loaded) buildPlan(loaded, m, detail);
    },
    [loaded, detail, buildPlan],
  );

  const changeDetail = useCallback(
    (level: DetailLevel) => {
      setDetail(level);
      if (loaded) buildPlan(loaded, mode, level);
    },
    [loaded, mode, buildPlan],
  );

  // Animation loop.
  useEffect(() => {
    if (!playing || !view) return;
    const len = view.plan.strokes.length;
    const tick = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      setProgress((p) => {
        const next = p + dt * speed;
        if (next >= len) {
          setPlaying(false);
          return len;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = null;
    };
  }, [playing, view, speed]);

  const idx = Math.min(total - 1, Math.floor(progress));
  const currentStroke = view && total > 0 ? view.plan.strokes[idx] : null;
  const currentHint = currentStroke?.hint ?? null;
  const currentLabel =
    view && currentStroke
      ? view.mode === "outline"
        ? (currentStroke as StrokePlan["strokes"][number]).layer
        : (currentStroke as PaintingPlan["strokes"][number]).band
      : "";

  // Audio narration — speak only when the guidance text changes (stage
  // transitions), never once per stroke, so it reads like a lesson voiceover.
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (!narrate) {
      window.speechSynthesis.cancel();
      lastSpokenRef.current = null;
      return;
    }
    if (currentHint && currentHint !== lastSpokenRef.current) {
      lastSpokenRef.current = currentHint;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(currentHint);
      u.rate = 1;
      window.speechSynthesis.speak(u);
    }
  }, [narrate, currentHint]);

  useEffect(
    () => () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    },
    [],
  );

  const togglePlay = () => {
    if (!view) return;
    if (progress >= total) setProgress(0);
    setPlaying((p) => !p);
  };

  const step = (delta: number) => {
    setPlaying(false);
    setProgress((p) => {
      const base = delta > 0 ? Math.floor(p + 1e-6) : Math.ceil(p - 1e-6);
      return Math.max(0, Math.min(total, base + delta));
    });
  };

  const downloadPlan = () => {
    if (!view) return;
    const blob = new Blob([JSON.stringify(view.plan, null, 2)], {
      type: "application/json",
    });
    triggerDownload(blob, view.mode === "painterly" ? "painting-plan.json" : "stroke-plan.json");
  };

  const downloadImage = async () => {
    if (!view) return;
    try {
      const blob =
        view.mode === "painterly"
          ? await exportPaintingPNG(view.plan)
          : await exportOutlinePNG(view.plan, showFill);
      triggerDownload(blob, "airtist.png");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not export image.");
    }
  };

  const pct = total > 0 ? Math.round((Math.min(progress, total) / total) * 100) : 0;

  return (
    <div className="app">
      <header className="masthead">
        <div className="brandmark">
          <IconSpark />
        </div>
        <div>
          <h1>AIrtist</h1>
          <div className="tag">learn to draw any image, stroke by stroke</div>
        </div>
      </header>
      <p className="lede">
        Upload an image and AIrtist turns it into an ordered sequence of strokes you can
        follow. <strong>Painterly</strong> builds it up like a painting — broad base
        masses first, fine accents last; <strong>Outline</strong> traces clean shape
        contours. Everything runs in your browser.
      </p>

      {!view && !processing && (
        <Dropzone
          dragging={dragging}
          setDragging={setDragging}
          inputRef={inputRef}
          onFile={handleFile}
        />
      )}

      {processing && (
        <div className="panel">
          <div className="processing">
            <span className="spinner" />
            Analysing image and planning strokes…
          </div>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {view && !processing && (
        <div className="studio">
          <div className="panel">
            <div className="panel-head">
              <h2>Canvas</h2>
              <span className="count-badge">{total.toLocaleString()} strokes</span>
            </div>
            {view.mode === "painterly" ? (
              <PaintingCanvas plan={view.plan} progress={progress} showGhost={showGhost} />
            ) : (
              <StrokeCanvas
                plan={view.plan}
                progress={progress}
                showFill={showFill}
                showGhost={showGhost}
              />
            )}
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Lesson</h2>
            </div>
            <div className="controls">
              <div className="segmented" role="group" aria-label="Render mode">
                {MODES.map((m) => (
                  <button
                    key={m.value}
                    className={mode === m.value ? "active" : ""}
                    onClick={() => changeMode(m.value)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="hint">
                <div className="meta">
                  <span className="swatch" style={{ background: currentStroke?.color ?? "#888" }} />
                  <span className="layer-pill">{currentLabel || "ready"}</span>
                  <span className="spacer" />
                  <span>
                    {Math.min(total, Math.floor(progress) + 1)} / {total.toLocaleString()}
                  </span>
                </div>
                {currentHint ?? "Press play to begin the lesson."}
              </div>

              <div className="transport">
                <button
                  className="icon-btn"
                  onClick={() => step(-1)}
                  disabled={progress <= 0}
                  aria-label="Previous stroke"
                  title="Previous stroke"
                >
                  <IconPrev />
                </button>
                <button
                  className="icon-btn play"
                  onClick={togglePlay}
                  aria-label={playing ? "Pause" : "Play"}
                  title={playing ? "Pause" : "Play"}
                >
                  {playing ? <IconPause /> : <IconPlay />}
                </button>
                <button
                  className="icon-btn"
                  onClick={() => step(1)}
                  disabled={progress >= total}
                  aria-label="Next stroke"
                  title="Next stroke"
                >
                  <IconNext />
                </button>
                <button
                  className="icon-btn"
                  onClick={() => {
                    setPlaying(false);
                    setProgress(0);
                  }}
                  aria-label="Restart"
                  title="Restart"
                >
                  <IconRestart />
                </button>
              </div>

              <div className="scrubber-row">
                <input
                  className="scrubber"
                  type="range"
                  min={0}
                  max={total}
                  step={0.01}
                  value={progress}
                  onChange={(e) => {
                    setPlaying(false);
                    setProgress(Number(e.target.value));
                  }}
                  aria-label="Timeline"
                />
                <span className="progress-label">{pct}% complete</span>
              </div>

              <div className="fields">
                <div className="field">
                  <label htmlFor="detail">Detail</label>
                  <select
                    id="detail"
                    className="select"
                    value={detail}
                    onChange={(e) => changeDetail(e.target.value as DetailLevel)}
                  >
                    {DETAIL_LEVELS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="speed">Speed</label>
                  <select
                    id="speed"
                    className="select"
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                  >
                    {SPEEDS.map((s) => (
                      <option key={s} value={s}>
                        {s} strokes/s
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="toggles">
                {view.mode === "outline" && (
                  <Switch label="Fill" checked={showFill} onChange={setShowFill} />
                )}
                <Switch label="Ghost next" checked={showGhost} onChange={setShowGhost} />
                <Switch label="Narrate" checked={narrate} onChange={setNarrate} />
              </div>

              <div className="actions">
                <button className="btn primary" onClick={downloadImage}>
                  <IconImage />
                  Save image
                </button>
                <button className="btn" onClick={() => inputRef.current?.click()}>
                  <IconUpload />
                  New image
                </button>
                <button className="btn" onClick={downloadPlan}>
                  <IconDownload />
                  Plan (JSON)
                </button>
              </div>

              {refUrl && (
                <div className="reference">
                  <h2>Reference</h2>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={refUrl} alt="Original reference" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hidden input reused by "New image". */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      <p className="footnote">
        Runs entirely in your browser — images never leave your device. Painterly mode is
        coarse-to-fine stroke-based rendering: oriented brush dabs, largest masses first;
        Outline mode is colour-region decomposition (quantise → connected components →
        boundary tracing → simplify). Narration uses your browser&rsquo;s speech synthesis.
      </p>
    </div>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" />
      {label}
    </label>
  );
}

function Dropzone({
  dragging,
  setDragging,
  inputRef,
  onFile,
}: {
  dragging: boolean;
  setDragging: (v: boolean) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFile: (f: File) => void;
}) {
  return (
    <div
      className={`dropzone${dragging ? " drag" : ""}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
    >
      <div className="dz-icon">
        <IconUpload />
      </div>
      <strong>Drop an image here, or click to choose</strong>
      <span>PNG, JPG, or WebP — portraits, flowers, and bold shapes work best</span>
    </div>
  );
}
