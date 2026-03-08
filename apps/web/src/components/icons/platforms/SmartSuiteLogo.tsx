import type { SVGProps } from 'react';

/**
 * SmartSuite logo mark — placeholder for 14px rendering.
 * SmartSuite adapter ships in Phase 3; this provides the component slot.
 */
export function SmartSuiteLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 14 14"
      width={14}
      height={14}
      aria-hidden="true"
      {...props}
    >
      <rect x="1" y="1" width="12" height="12" rx="2" fill="#6366F1" />
      <path
        d="M4.5 8.5 7 4l2.5 4.5H4.5Z"
        fill="white"
        stroke="white"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
