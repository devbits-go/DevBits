/**
 * Global theme constants for the DevBits app.
 *
 * Font sizes and spacing use a rem-based scale (1rem = 16px).
 * Use the `rem()` helper to convert rem units to pixels.
 */

const BASE_FONT_SIZE = 16;

/**
 * Converts a rem value to pixels.
 * rem(1) = 16px, rem(1.5) = 24px, etc.
 */
export const rem = (value: number): number => Math.round(value * BASE_FONT_SIZE);

export const FontSize = {
  xs: rem(0.75),       // 12px – captions, badges
  sm: rem(0.875),      // 14px – secondary text
  base: rem(0.9375),   // 15px – body / default text
  md: rem(1),          // 16px – subtitle
  xl: rem(1.5),        // 24px – section title
  pageTitle: rem(1.625), // 26px – page-level headings
  display: rem(1.75),  // 28px – hero/display headings
} as const;

export const LineHeight = {
  xs: rem(1),          // 16px
  base: rem(1.375),    // 22px
  md: rem(1.5),        // 24px
  xl: rem(1.75),       // 28px
  pageTitle: rem(1.875), // 30px
  display: rem(2),     // 32px
} as const;

export const Spacing = {
  xs: rem(0.25),  // 4px
  sm: rem(0.5),   // 8px
  md: rem(0.75),  // 12px
  lg: rem(1),     // 16px
  xl: rem(1.25),  // 20px
  xxl: rem(1.5),  // 24px
} as const;

export const IconButton = {
  size: 34,
  borderRadius: 10,
} as const;
