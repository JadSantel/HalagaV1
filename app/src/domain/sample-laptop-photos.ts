export type SamplePhoto = { id: string; label: string; alt: string; src: string };

function illustration(drawing: string): string {
  // Fixed, code-authored SVG fixtures only: no external resources or user content.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">
    <rect width="640" height="420" fill="#f1f3ee"/>
    <rect x="24" y="24" width="592" height="372" rx="16" fill="none" stroke="#75837c"/>
    ${drawing}
    <text x="320" y="368" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#17231f">SAMPLE IMAGE - FICTIONAL LAPTOP</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const sampleLaptopPhotos: readonly SamplePhoto[] = [
  {
    id: "front", label: "Front view",
    alt: "Sample illustration of a fictional open laptop with screen, keyboard, and trackpad. Not an actual item photo.",
    src: illustration(`<rect x="144" y="76" width="352" height="216" rx="12" fill="#53615c"/>
      <rect x="160" y="92" width="320" height="182" rx="4" fill="#cce7dc"/>
      <rect x="210" y="126" width="220" height="18" rx="4" fill="#176b59"/>
      <rect x="210" y="160" width="152" height="12" rx="4" fill="#75837c"/>
      <path d="M144 292H496L548 330H92Z" fill="#b5beb8" stroke="#53615c" stroke-width="3"/>
      <path d="M184 304H456" stroke="#53615c" stroke-width="10" stroke-dasharray="13 5"/>
      <rect x="290" y="316" width="60" height="9" rx="3" fill="#75837c"/>`),
  },
  {
    id: "lid", label: "Closed lid with cosmetic scratch",
    alt: "Sample illustration of a fictional closed laptop with a scratch on its lid. Not an actual item photo.",
    src: illustration(`<rect x="122" y="110" width="396" height="194" rx="16" fill="#b5beb8" stroke="#53615c" stroke-width="4"/>
      <rect x="302" y="186" width="36" height="36" rx="6" fill="#75837c"/>
      <path d="M390 146L438 179M400 146L443 174" stroke="#53615c" stroke-width="3"/>
      <path d="M136 295H504" stroke="#75837c" stroke-width="4"/>`),
  },
  {
    id: "underside", label: "Underside view",
    alt: "Sample illustration of a fictional laptop underside with vents, screws, and feet. Not an actual item photo.",
    src: illustration(`<rect x="122" y="96" width="396" height="226" rx="16" fill="#d9dfda" stroke="#53615c" stroke-width="4"/>
      <path d="M212 136V173M230 136V173M248 136V173M266 136V173M284 136V173M302 136V173M320 136V173M338 136V173M356 136V173M374 136V173M392 136V173M410 136V173" stroke="#75837c" stroke-width="5"/>
      <rect x="245" y="212" width="150" height="42" rx="4" fill="#b5beb8"/>
      <path d="M152 122H178M462 122H488M152 294H178M462 294H488" stroke="#53615c" stroke-width="10" stroke-linecap="round"/>
      <circle cx="168" cy="208" r="4" fill="#53615c"/><circle cx="472" cy="208" r="4" fill="#53615c"/>`),
  },
];

export type PhotoSelectionAction = { type: "select" | "remove"; id: string } | { type: "clear" };

export function updateSamplePhotoSelection(current: string[], action: PhotoSelectionAction): string[] {
  if (action.type === "clear") return [];
  if (action.type === "remove") return current.filter((id) => id !== action.id);
  if (!sampleLaptopPhotos.some((photo) => photo.id === action.id) || current.includes(action.id)) return current;
  return [...current, action.id];
}

export function selectedSamplePhotos(ids: readonly string[]): SamplePhoto[] {
  return [...new Set(ids)].flatMap((id) => {
    const photo = sampleLaptopPhotos.find((candidate) => candidate.id === id);
    return photo ? [{ ...photo }] : [];
  });
}
