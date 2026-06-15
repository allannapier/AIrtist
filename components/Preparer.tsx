"use client";

import { useEffect, useRef, useState } from "react";
import type { LoadedImage } from "@/lib/loadImage";
import { FULL_CROP, prepareImage, type CropRect } from "@/lib/preprocess";
import type { PixelImage } from "@/lib/types";
import { IconCrop, IconImage } from "@/components/icons";

interface Props {
  loaded: LoadedImage;
  onPaint: (prepared: PixelImage, url: string) => void;
  onCancel: () => void;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function drawTo(canvas: HTMLCanvasElement, img: PixelImage) {
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const id = ctx.createImageData(img.width, img.height);
  id.data.set(img.data);
  ctx.putImageData(id, 0, 0);
}

export default function Preparer({ loaded, onPaint, onCancel }: Props) {
  const [crop, setCrop] = useState<CropRect>(FULL_CROP);
  const [removeBg, setRemoveBg] = useState(false);
  const [tolerance, setTolerance] = useState(45);
  const [dragging, setDragging] = useState(false);
  const [prepared, setPrepared] = useState<PixelImage | null>(null);

  const frameRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef<[number, number]>([0, 0]);
  const previewRef = useRef<HTMLCanvasElement | null>(null);

  const tight = crop.w < 0.999 || crop.h < 0.999 || crop.x > 0.001 || crop.y > 0.001;

  // Recompute the prepared image (debounced to a frame) when settings change.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setPrepared(prepareImage(loaded.imageData, crop, removeBg, tolerance));
    });
    return () => cancelAnimationFrame(raf);
  }, [loaded, crop, removeBg, tolerance]);

  useEffect(() => {
    if (prepared && previewRef.current) drawTo(previewRef.current, prepared);
  }, [prepared]);

  const toNorm = (e: React.PointerEvent): [number, number] => {
    const r = frameRef.current!.getBoundingClientRect();
    return [clamp01((e.clientX - r.left) / r.width), clamp01((e.clientY - r.top) / r.height)];
  };

  const paintIt = () => {
    const img = prepared ?? prepareImage(loaded.imageData, crop, removeBg, tolerance);
    const c = document.createElement("canvas");
    drawTo(c, img);
    onPaint(img, c.toDataURL("image/png"));
  };

  return (
    <div className="prep">
      <div className="panel">
        <div className="panel-head">
          <h2>Prepare</h2>
          {tight && <span className="count-badge">cropped</span>}
        </div>
        <div
          className="crop-frame"
          ref={frameRef}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            const [x, y] = toNorm(e);
            startRef.current = [x, y];
            setDragging(true);
            setCrop({ x, y, w: 0, h: 0 });
          }}
          onPointerMove={(e) => {
            if (!dragging) return;
            const [x, y] = toNorm(e);
            const [sx, sy] = startRef.current;
            setCrop({ x: Math.min(sx, x), y: Math.min(sy, y), w: Math.abs(x - sx), h: Math.abs(y - sy) });
          }}
          onPointerUp={() => {
            setDragging(false);
            setCrop((c) => (c.w < 0.05 || c.h < 0.05 ? FULL_CROP : c));
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={loaded.url} alt="Image to prepare" draggable={false} />
          {tight && (
            <div
              className="crop-box"
              style={{
                left: `${crop.x * 100}%`,
                top: `${crop.y * 100}%`,
                width: `${crop.w * 100}%`,
                height: `${crop.h * 100}%`,
              }}
            />
          )}
          {!tight && <div className="crop-hint">Drag to crop</div>}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Tidy up</h2>
        </div>
        <div className="controls">
          <div className="prep-preview">
            <canvas ref={previewRef} />
          </div>

          <div className="toggles">
            <label className="switch">
              <input type="checkbox" checked={removeBg} onChange={(e) => setRemoveBg(e.target.checked)} />
              <span className="track" />
              Remove background
            </label>
            {tight && (
              <button className="btn" onClick={() => setCrop(FULL_CROP)}>
                Reset crop
              </button>
            )}
          </div>

          {removeBg && (
            <div className="field">
              <label htmlFor="tol">
                Background strength — higher also removes matching colours elsewhere
              </label>
              <input
                id="tol"
                className="scrubber"
                type="range"
                min={0}
                max={120}
                step={1}
                value={tolerance}
                onChange={(e) => setTolerance(Number(e.target.value))}
              />
            </div>
          )}

          <p className="mix-note">
            Drag on the image to crop to your subject. Background removal works best when the
            subject sits on a fairly plain background — a flower, a glass. Busy backgrounds
            won&rsquo;t separate cleanly.
          </p>

          <div className="actions">
            <button className="btn primary" onClick={paintIt}>
              <IconCrop />
              Paint it
            </button>
            <button className="btn" onClick={onCancel}>
              <IconImage />
              Choose another
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
