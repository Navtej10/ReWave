// Tiny inline SVG icons. Decorative by default (aria-hidden); they sit next to text
// or inside aria-labeled buttons, so they never carry meaning alone.

type IconProps = { className?: string };

export function SparkleIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M8 1l1.3 3.4L12.7 6 9.3 7.3 8 10.7 6.7 7.3 3.3 6l3.4-1.6L8 1zM12.5 9.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z"
      />
    </svg>
  );
}

export function PencilIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M11.5 1.5a1.4 1.4 0 0 1 2 2L5.3 11.7l-2.8.8.8-2.8 8.2-8.2zm1 1L11 4l1 1 1.5-1.5-1-1z"
      />
    </svg>
  );
}

export function BackIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M10.3 2.3L4.6 8l5.7 5.7 1.1-1.1L6.8 8l4.6-4.6-1.1-1.1z" />
    </svg>
  );
}

export function SendIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M1.5 14.5l13-6.5-13-6.5 2.3 6.5-2.3 6.5zm2.1-4.6L10 8 3.6 6.1 4.6 8l-1 1.9z" />
    </svg>
  );
}
