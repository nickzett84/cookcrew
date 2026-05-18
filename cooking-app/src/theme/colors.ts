// Resolved tokens from CookCrew Handoff.md §3.
// Order of authority: DESIGN.md > WIREFRAMES.md > Handoff. Decisions locked 2026-05-06.

export const colors = {
  // surfaces
  paper:     '#F7F5F0',
  surface:   '#EFEBE2',
  fill:      '#E5E0D5',
  fillSoft:  '#F0EBDF',

  // ink
  ink:       '#1F1B16',
  inkSoft:   '#5C544A',
  inkFaint:  '#9A9285',
  line:      '#1F1B16',
  lineSoft:  '#D4CDBE',

  // semantic
  accent:    '#C2532A',
  accentSoft:'#F0DBCD',
  sage:      '#5A7A4A',
  sageSoft:  '#D5DDC8',
  ochre:     '#B58233',
  ochreSoft: '#EDDFC2',
  steel:     '#3F5765',
  steelSoft: '#D2DBE0',
} as const;

// 10-color avatar palette. Earth-tone register, all readable with ink text on top.
// Index 0 (tan) is the host's default per the prototype.
export const cookPalette = [
  '#E6CDA8', // tan        — A
  '#CDD9BE', // sage       — B
  '#E3C7BE', // dusty rose — C
  '#D2DBE0', // steel blue — D
  '#EBD7A0', // straw      — E
  '#D7C0CC', // mauve      — F
  '#F0C9B0', // peach      — G
  '#C9D4B6', // moss       — H
  '#D8C8B0', // putty      — I
  '#B5C9C5', // eucalyptus — J
] as const;

export type CookColor = typeof cookPalette[number];
