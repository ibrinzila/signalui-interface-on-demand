const icon = (body: string, label?: string): string => `
<svg viewBox="0 0 24 24" aria-hidden="${label ? 'false' : 'true'}"${label ? ` role="img" aria-label="${label}"` : ''} focusable="false">
  ${body}
</svg>`;

export const icons = {
  spark: icon('<path d="M12 2l1.7 5.1L19 9l-5.3 1.9L12 16l-1.7-5.1L5 9l5.3-1.9L12 2Z"/><path d="M5 14l.9 2.6L9 18l-3.1 1.4L5 22l-.9-2.6L1 18l3.1-1.4L5 14Z"/>'),
  grid: icon('<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>'),
  focus: icon('<circle cx="12" cy="12" r="4"/><path d="M3 9V5a2 2 0 0 1 2-2h4M15 3h4a2 2 0 0 1 2 2v4M21 15v4a2 2 0 0 1-2 2h-4M9 21H5a2 2 0 0 1-2-2v-4"/>'),
  shield: icon('<path d="M12 3 4.5 6v5.5c0 4.8 3.1 7.9 7.5 9.5 4.4-1.6 7.5-4.7 7.5-9.5V6L12 3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>'),
  evidence: icon('<path d="M6 3h9l3 3v15H6V3Z"/><path d="M15 3v4h4M9 12h6M9 16h6M9 8h2"/>'),
  history: icon('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v6l4 2"/>'),
  arrow: icon('<path d="M5 12h14M14 7l5 5-5 5"/>'),
  check: icon('<path d="m5 12 4 4L19 6"/>'),
  warning: icon('<path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5M12 17.5v.1"/>'),
  info: icon('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.1"/>'),
  lock: icon('<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
  eye: icon('<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>'),
  rotate: icon('<path d="M4 4v6h6M20 20v-6h-6"/><path d="M20 9a8 8 0 0 0-13.5-3L4 10M4 15a8 8 0 0 0 13.5 3L20 14"/>'),
  wand: icon('<path d="m4 20 10-10M13 4l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3ZM19 14l.7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7L19 14Z"/>'),
  user: icon('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  terminal: icon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/>'),
  close: icon('<path d="m6 6 12 12M18 6 6 18"/>'),
  chevron: icon('<path d="m8 10 4 4 4-4"/>'),
  audit: icon('<path d="M9 3h6l1 3h3v15H5V6h3l1-3Z"/><path d="M9 12h6M9 16h4M9 8h6"/>'),
  photo: icon('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m4 18 5-5 3 3 3-4 5 6"/>'),
  external: icon('<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v6H5V6h6"/>'),
} as const;
