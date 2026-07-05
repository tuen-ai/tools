// Shared design constants used across both guest and admin surfaces.
// Keep these in sync with tailwind.config.ts.

/**
 * The blush-500 token value (vintage burgundy). An event with no custom
 * `theme.primaryColor` renders this on the guest page, so the admin colour
 * picker and the printable poster must default to the *same* value —
 * otherwise the admin previews a colour their guests never see.
 */
export const DEFAULT_PRIMARY_COLOR = "#7C3030";

/**
 * QR module + quiet-zone colours. Pure black on white maximises scan
 * reliability and the white quiet zone blends into the white poster/QR
 * cards. (The pre-redesign #2A2622 / #FBF8F3 pair was a stray legacy hex
 * absent from the current palette.)
 */
export const QR_DARK = "#000000";
export const QR_LIGHT = "#FFFFFF";
