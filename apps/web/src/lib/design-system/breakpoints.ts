/**
 * EveryStack Responsive Breakpoints
 *
 * Three semantic breakpoints:
 *   - Phone:   < 768px  (Operate & Consume)
 *   - Tablet:  >= 768px (Build & Operate)
 *   - Desktop: >= 1440px (Build)
 *
 * These are added as Tailwind screen aliases alongside the default sm/md/lg/xl.
 */

export interface Breakpoint {
  min?: number;
  max?: number;
}

export const BREAKPOINTS = {
  phone: { max: 767 },
  tablet: { min: 768 },
  desktop: { min: 1440 },
} as const satisfies Record<string, Breakpoint>;

export type BreakpointName = keyof typeof BREAKPOINTS;
