/**
 * Iconografia de la suite: trazo lineal 2px, un solo estilo outline, hereda el
 * color del texto (skills/patron-diseno.md seccion 4).
 */

export type IconName =
  | "plus"
  | "edit"
  | "trash"
  | "check"
  | "x"
  | "search"
  | "chevron-left"
  | "chevron-right"
  | "chevron-down"
  | "sun"
  | "moon"
  | "bell"
  | "user"
  | "menu"
  | "refresh"
  | "filter"
  | "building"
  | "grid"
  | "cart"
  | "clipboard"
  | "package"
  | "truck"
  | "chart"
  | "award"
  | "arrow-right"
  | "list"
  | "shield"
  | "wallet"
  | "coins"
  | "users"
  | "lock"
  | "dot"
  | "send"
  | "undo"
  | "clock"
  | "tag"
  | "layers"
  | "more"
  | "sliders"
  | "help"
  | "download"
  | "copy"
  | "zap"
  | "star";

const PATHS: Record<IconName, React.ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" />,
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  "chevron-left": <path d="m15 18-6-6 6-6" />,
  "chevron-right": <path d="m9 18 6-6-6-6" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
  bell: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a7 7 0 0 1 14 0v1" />
    </>
  ),
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  refresh: (
    <>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 3v6h-6" />
    </>
  ),
  filter: <path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3Z" />,
  building: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h6" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  cart: (
    <>
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L23 7H6" />
    </>
  ),
  clipboard: (
    <>
      <rect x="8" y="3" width="8" height="4" rx="1" />
      <path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
    </>
  ),
  package: (
    <>
      <path d="m3 7 9-4 9 4-9 4-9-4Z" />
      <path d="M3 7v10l9 4 9-4V7M12 11v10" />
    </>
  ),
  truck: (
    <>
      <path d="M1 4h14v12H1zM15 8h4l4 4v4h-8" />
      <circle cx="6" cy="19" r="1.5" />
      <circle cx="18" cy="19" r="1.5" />
    </>
  ),
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  award: (
    <>
      <circle cx="12" cy="9" r="6" />
      <path d="m9 14-2 7 5-3 5 3-2-7" />
    </>
  ),
  "arrow-right": <path d="M5 12h14M13 5l7 7-7 7" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  shield: <path d="M12 3l8 3v6c0 5-3.4 7.7-8 9-4.6-1.3-8-4-8-9V6l8-3Z" />,
  wallet: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3" />
      <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a1 1 0 0 0-1-1H6a3 3 0 0 1-3-3Z" />
      <path d="M16 13h.01" />
    </>
  ),
  coins: (
    <>
      <circle cx="8" cy="8" r="5" />
      <path d="M18.09 10.37A5 5 0 1 1 15 21M7 6h1v4M16.71 13.88l.7.71-2.82 2.82" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 21v-1a6.5 6.5 0 0 1 13 0v1M17 5.5a3.5 3.5 0 0 1 0 7M22 21v-1a6.5 6.5 0 0 0-5-6.3" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  dot: <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />,
  send: <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />,
  undo: <path d="M9 14 4 9l5-5M4 9h11a6 6 0 0 1 0 12h-3" />,
  copy: (<><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></>),
  zap: <path d="M13 2 3 14h9l-1 8 10-12h-9z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  tag: (
    <>
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 3 12V4a1 1 0 0 1 1-1h8a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.6Z" />
      <path d="M7.5 7.5h.01" />
    </>
  ),
  layers: (
    <>
      <path d="m12 2 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
    </>
  ),
  // Kebab vertical (⋮) — convencion estandar de "más opciones" por fila
  // (Android/Material/Gmail), distinto del "..." horizontal de truncado de
  // texto para que no se confundan a simple vista.
  more: (
    <>
      <circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  // Controles deslizantes: "gestionar / acciones de esta fila" — se distingue de un
  // simple menu de puntos y comunica que hay operaciones disponibles.
  sliders: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.1 9a3 3 0 0 1 5.82 1c0 2-3 2-3 4" />
      <path d="M12 17h.01" />
    </>
  ),
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5M12 15V3" />
    </>
  ),
  star: (
    <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z" />
  ),
};

export default function Icon(props: {
  name: IconName;
  size?: number;
  className?: string;
}): React.ReactElement {
  const size = props.size ?? 18;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      aria-hidden="true"
      // El `max-width:100%` global de index.css (para img/svg/video/canvas) se
      // resuelve contra el ancho del contenedor; dentro de un boton
      // inline-flex sin ancho propio (p. ej. el "..." de RowActions en una
      // celda de tabla) esa resolucion de porcentaje puede colapsar a 0 y
      // dejar el icono invisible aunque el fill/stroke calculado sea correcto.
      // Un tamano en px por estilo inline (mayor especificidad que la hoja de
      // estilos) evita la ambiguedad de raiz para TODOS los iconos.
      style={{ width: size, height: size, flexShrink: 0 }}
    >
      {PATHS[props.name]}
    </svg>
  );
}
