"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import StrokeCanvas from "@/components/StrokeCanvas";
import { loadImageFile } from "@/lib/loadImage";
import { generateStrokePlan } from "@/lib/pipeline";
import { DEFAULT_OPTIONS, type StrokePlan } from "@/lib/types";

const SPEEDS = [0.5, 1, 2, 4];

export default function Page() {
  const [plan, setPlan] = useState<StrokePlan | null>(null);
  const [refUrl, setRefUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.5); // strokes per second
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showFill, setShowFill] = useState(true);
  const [showGhost, setShowGhost] = useState(true);

  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const total = plan?.strokes.length ?? 0;

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setProcessing(true);
    setPlaying(false);
    setProgress(0);
    try {
      const loaded = await loadImageFile(file, DEFAULT_OPTIONS.maxDimension);
      // Yield a frame so the spinner paints before the synchronous pipeline.
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const next = generateStrokePlan(
        loaded.imageData,
        loaded.sourceWidth,
        loaded.sourceHeight,
      );
      setRefUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return loaded.url;
      });
      if (next.strokes.length === 0) {
        setError("Couldn't find drawable regions in that image. Try one with clearer shapes.");
        setPlan(null);
      } else {
        setPlan(next);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong processing the image.");
    } finally {
      setProcessing(false);
    }
  }, []);

  // Animation loop.
  useEffect(() => {
    if (!playing || !plan) return;
    const tick = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      setProgress((p) => {
        const next = p + dt * speed;
        if (next >= plan.strokes.length) {
          setPlaying(false);
          return plan.strokes.length;
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
  }, [playing, plan, speed]);

  const togglePlay = () => {
    if (!plan) return;
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
    if (!plan) return;
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stroke-plan.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentStroke =
    plan && total > 0 ? plan.strokes[Math.min(total - 1, Math.floor(progress))] : null;

  return (
    <div className="app">
      <header className="masthead">
        <h1>AIrtist</h1>
        <span className="tag">learn to draw any image, stroke by stroke</span>
      </header>
      <p className="lede">
        Upload an image and AIrtist decomposes it into an ordered sequence of strokes —
        the big forms first, then contours, then the fine detail — so you can follow
        along and draw it yourself.
      </p>

      {!plan && !processing && (
        <Dropzone
          dragging={dragging}
          setDragging={setDragging}
          inputRef={inputRef}
          onFile={handleFile}
        />
      )}

      {processing && (
        <div className="panel">
          <span className="spinner" />
          Analysing image and planning strokes…
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {plan && !processing && (
        <div className="studio">
          <div className="panel">
            <h2>Canvas</h2>
            <StrokeCanvas
              plan={plan}
              progress={progress}
              showFill={showFill}
              showGhost={showGhost}
            />
          </div>

          <div className="panel">
            <h2>Lesson</h2>
            <div className="controls">
              <div className="hint">
                {currentStroke ? (
                  <>
                    <div className="meta">
                      <span
                        className="swatch"
                        style={{ background: currentStroke.color }}
                      />
                      <span className="layer-pill">{currentStroke.layer}</span>
                      <span>
                        stroke {Math.min(total, Math.floor(progress) + 1)} / {total}
                      </span>
                    </div>
                    {currentStroke.hint}
                  </>
                ) : (
                  "Press play to begin."
                )}
              </div>

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
              />

              <div className="btn-row">
                <button className="btn" onClick={() => step(-1)} disabled={progress <= 0}>
                  ‹ Prev
                </button>
                <button className="btn primary" onClick={togglePlay}>
                  {playing ? "Pause" : progress >= total ? "Replay" : "Play"}
                </button>
                <button
                  className="btn"
                  onClick={() => step(1)}
                  disabled={progress >= total}
                >
                  Next ›
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    setPlaying(false);
                    setProgress(0);
                  }}
                >
                  Restart
                </button>
              </div>

              <div className="row">
                <label htmlFor="speed">Speed</label>
                <select
                  id="speed"
                  className="select"
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                >
                  {SPEEDS.map((s) => (
                    <option key={s} value={s}>
                      {s}× ({s} strokes/s)
                    </option>
                  ))}
                </select>
              </div>

              <div className="toggles">
                <label>
                  <input
                    type="checkbox"
                    checked={showFill}
                    onChange={(e) => setShowFill(e.target.checked)}
                  />
                  Show colour fill
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={showGhost}
                    onChange={(e) => setShowGhost(e.target.checked)}
                  />
                  Ghost next stroke
                </label>
              </div>

              <div className="btn-row">
                <button className="btn" onClick={() => inputRef.current?.click()}>
                  New image
                </button>
                <button className="btn" onClick={downloadPlan}>
                  Download plan (JSON)
                </button>
              </div>

              {refUrl && (
                <div className="reference">
                  <h2 style={{ marginTop: 4 }}>Reference</h2>
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
        Runs entirely in your browser — images never leave your device. Strokes are
        derived by colour-region decomposition (k-means quantisation → connected
        components → boundary tracing → Douglas-Peucker simplification), ordered largest
        form first.
      </p>
    </div>
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
      <strong>Drop an image here, or click to choose</strong>
      <span>PNG, JPG, or WebP — portraits, flowers, and bold shapes work best</span>
    </div>
  );
}
