// Building glyphs for the street map, one per kind of place, drawn on a 24-unit grid.
const GLYPHS = {
  house: <path d="M4 11 12 4l8 7M6 10v10h12V10M10 20v-6h4v6" />,
  mansion: <path d="M2 11 12 4l10 7M4 10v10h16V10M7 13h3v3H7zM14 13h3v3h-3zM11 20v-4h2v4" />,
  garage: <path d="M3 10 12 5l9 5v10H3zM6 20v-7h12v7M6 15.5h12M6 18h12" />,
  bank: <path d="M3 9 12 4l9 5zM4 20h16M5 18h14M6.5 10v8M10 10v8M14 10v8M17.5 10v8" />,
  vault: <><rect x="3.5" y="4" width="17" height="16" rx="2" /><circle cx="12" cy="12" r="4.5" /><path d="M12 7.5V9M12 15v1.5M7.5 12H9M15 12h1.5M20.5 8H22M20.5 16H22" /></>,
  office: <path d="M5 21V5l7-2 7 2v16M3 21h18M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2" />,
  tower: <path d="M7 21V3h10v18M3 21h18M9.5 6h1.5M13 6h1.5M9.5 10h1.5M13 10h1.5M9.5 14h1.5M13 14h1.5M11 21v-3h2v3" />,
  lab: <path d="M9 3h6M10 3v6l-5.5 10A1.5 1.5 0 0 0 6 21h12a1.5 1.5 0 0 0 1.5-2L14 9V3M7.2 15h9.6" />,
  radio: <path d="M12 9v12M8 21l4-12 4 12M9.5 16h5M7.5 6a6 6 0 0 1 9 0M9.5 8a3 3 0 0 1 5 0" />,
  crate: <path d="M3 5h18v15H3zM3 5l18 15M21 5 3 20" />,
  door: <path d="M6 21V3h12v18M3 21h18M15 12h.01" />,
  theatre: <path d="M2 4h20M3 4v16M21 4v16M3 4q5 7 2 16M21 4q-5 7-2 16M2 20h20M9 14h6" />,
  star: <path d="m12 3 2.6 6 6.4.5-4.9 4.3 1.5 6.7L12 17l-5.6 3.5 1.5-6.7L3 9.5 9.4 9z" />,
  chair: <path d="M6 11V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3M3 12a2 2 0 0 1 4 0v3h10v-3a2 2 0 0 1 4 0v6H3zM5 18v2M19 18v2" />,
  ticket: <path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4zM14 7v2M14 11v2M14 15v2" />,
  hanger: <path d="M10 6a2 2 0 1 1 2 2v2l-9 7h18l-9-7" />,
  key: <><circle cx="7" cy="12" r="4" /><path d="M11 12h10M17 12v3M20 12v2" /></>,
  warehouse: <path d="M2 20V10l5-4v4l5-4v4l5-4v4l5-4v14zM9 20v-6h6v6" />,
  club: <path d="M12 3 20 6v5c0 5-4 8.5-8 10-4-1.5-8-5-8-10V6zM9 11l2 2 4-4" />,
  wrench: <path d="M15 3a5 5 0 0 0-4.5 7L3 17.5 6.5 21l7.5-7.5a5 5 0 0 0 7-4.5l-3 3-3-1-1-3z" />,
  truck: <><path d="M2 6h12v11H2zM14 10h4l3 3v4h-7" /><circle cx="6" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></>,
  pot: <path d="M4 10h16v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3zM2 10h2M20 10h2M9 7q1-2 0-4M14 7q1-2 0-4" />,
  cross: <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" />,
  book: <path d="M4 4h7a1 1 0 0 1 1 1v15a1 1 0 0 0-1-1H4zM20 4h-7a1 1 0 0 0-1 1v15a1 1 0 0 1 1-1h7z" />,
  tree: <><circle cx="12" cy="9" r="6" /><path d="M12 15v6M9 21h6" /></>,
  pub: <path d="M5 7h10v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zM15 10h3a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-3M5 7q0-3 3-2.5 2-1.5 4 0 3-.5 3 2.5M8 11v6M11.5 11v6" />,
  room: <path d="M4 4h16v16H4zM4 12h6M14 12h6" />,
};

export default function MapIcon({ kind, ...rest }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {GLYPHS[kind] ?? GLYPHS.room}
    </svg>
  );
}
