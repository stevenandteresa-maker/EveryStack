import type { SVGProps } from 'react';

/**
 * Airtable logo mark — simplified for 14px rendering.
 * Two-color mark (yellow + blue) matching Airtable brand.
 */
export function AirtableLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 14 14"
      width={14}
      height={14}
      aria-hidden="true"
      {...props}
    >
      <path
        d="M6.44 1.36 1.36 3.14a.47.47 0 0 0 0 .88l5.1 1.84a1.4 1.4 0 0 0 .96 0l5.1-1.84a.47.47 0 0 0 0-.88L7.4 1.36a1.4 1.4 0 0 0-.96 0Z"
        fill="#FCB400"
      />
      <path
        d="M7.38 7.16V12.8a.46.46 0 0 0 .64.44l5.32-2.1a.47.47 0 0 0 .3-.44V5.06a.46.46 0 0 0-.65-.44L7.68 6.72a.47.47 0 0 0-.3.44Z"
        fill="#18BFFF"
      />
      <path
        d="M5.98 7.56 4.5 6.94l-4.14 2.2a.46.46 0 0 0 .26.86l5.12-.7a.47.47 0 0 0 .24-.78V7.56Z"
        fill="#F82B60"
      />
      <path
        d="M5.98 7.56V12.5a.46.46 0 0 1-.72.38L.5 9.96l4-2.12.76.34.72 1.34v-1.96Z"
        fill="#F82B60"
        opacity={0.5}
      />
    </svg>
  );
}
