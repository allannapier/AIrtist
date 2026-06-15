// Minimal inline icon set (stroke-based, currentColor) so the UI ships no
// icon-font or image dependencies.

type P = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconPlay(_: P) {
  return (
    <svg {...base} fill="currentColor" stroke="none">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export function IconPause(_: P) {
  return (
    <svg {...base} fill="currentColor" stroke="none">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

export function IconPrev(_: P) {
  return (
    <svg {...base}>
      <path d="M18 17l-6-5 6-5" />
      <path d="M11 17l-6-5 6-5" />
    </svg>
  );
}

export function IconNext(_: P) {
  return (
    <svg {...base}>
      <path d="M6 17l6-5-6-5" />
      <path d="M13 17l6-5-6-5" />
    </svg>
  );
}

export function IconRestart(_: P) {
  return (
    <svg {...base}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v4h4" />
    </svg>
  );
}

export function IconDownload(_: P) {
  return (
    <svg {...base}>
      <path d="M12 3v12" />
      <path d="M7 12l5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

export function IconImage(_: P) {
  return (
    <svg {...base}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.6" fill="currentColor" stroke="none" />
      <path d="M5 18l5-5 4 4 2-2 3 3" />
    </svg>
  );
}

export function IconUpload(_: P) {
  return (
    <svg {...base}>
      <path d="M12 19V7" />
      <path d="M7 12l5-5 5 5" />
      <path d="M5 21h14" />
    </svg>
  );
}

export function IconCrop(_: P) {
  return (
    <svg {...base}>
      <path d="M6 2v16h16" />
      <path d="M2 6h16v16" />
    </svg>
  );
}

export function IconSpark(_: P) {
  return (
    <svg viewBox="0 0 24 24" fill="#0a0c11" stroke="none">
      <path d="M12 3l2.2 5.6L20 11l-5.8 2.4L12 19l-2.2-5.6L4 11l5.8-2.4z" />
      <circle cx="18.5" cy="5.5" r="1.4" />
    </svg>
  );
}
