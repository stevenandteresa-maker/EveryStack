import type { SVGProps } from 'react';

/**
 * Notion logo mark — simplified for 14px rendering.
 * Single-color black mark.
 */
export function NotionLogo(props: SVGProps<SVGSVGElement>) {
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
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2.64 2.04c.44.36.6.34 1.42.28l7.08-.42c.16 0 .02-.16-.02-.18l-1.18-.86c-.22-.18-.52-.36-1.1-.3L2.08 1.2c-.26.04-.32.16-.2.26l.76.58Zm.48 1.62v7.46c0 .4.2.56.64.52l7.78-.44c.44-.04.5-.28.5-.6V3.2c0-.3-.12-.46-.38-.44l-8.12.46c-.3.02-.42.16-.42.44ZM10.38 3.9c.04.18 0 .36-.18.38l-.38.08v5.5c-.34.18-.64.28-.9.28-.42 0-.52-.12-.84-.52L5.92 6.28v3.08l.78.18s0 .36-.5.36l-1.38.08c-.04-.08 0-.28.14-.32l.38-.1V5.08l-.52-.04c-.04-.18.06-.44.36-.46l1.48-.1 2.24 3.42V5.1l-.66-.08c-.04-.22.12-.38.32-.4l1.38-.08.42.36Z"
        fill="currentColor"
      />
    </svg>
  );
}
