import { motion } from "framer-motion";

// Spinning loader ring. currentColor so it inherits the button's text color.
export function Spinner(props: { size?: number }) {
  const size = props.size ?? 16;
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block" }}
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, ease: "linear", duration: 0.7 }}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth={3}
        strokeOpacity={0.25}
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
      />
    </motion.svg>
  );
}
