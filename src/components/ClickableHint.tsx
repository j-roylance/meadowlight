/** Tiny badge: this building does something when you click it. */
export function ClickableHintIcon({
  size = 16,
  title = "Click for actions",
}: {
  size?: number;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      className="drop-shadow-sm"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <circle cx="10" cy="10" r="9" fill="#F5E6C8" stroke="#6B9E4A" strokeWidth="1.5" />
      {/* Simple cursor / pointer */}
      <path
        d="M7.2 5.5 L7.2 13.8 L9.1 11.9 L10.6 15.4 L12.1 14.7 L10.6 11.2 L13.2 11.2 Z"
        fill="#3A3020"
        stroke="#3A3020"
        strokeWidth="0.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
