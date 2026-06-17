import React, { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  /** Text shown in the tooltip bubble. If empty, no tooltip is rendered. */
  text?: string;
  children: React.ReactNode;
  /** Classes applied to the inline trigger wrapper (e.g. "block truncate"). */
  className?: string;
  /** ms to wait before showing (avoids flicker on quick mouse passes). */
  delay?: number;
}

/**
 * Lightweight hover tooltip styled to match the app's dark sidebar tooltip.
 * The bubble is rendered through a portal to <body>, so it is never clipped by
 * an ancestor's `overflow: hidden` (e.g. truncated table cells).
 */
const Tooltip: React.FC<TooltipProps> = ({ text, children, className = "", delay = 300 }) => {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<number | undefined>(undefined);

  const show = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    timerRef.current = window.setTimeout(() => {
      const r = el.getBoundingClientRect();
      // Bubble is max-w 320px and centered on `left` via translateX(-50%).
      // Clamp the center so the bubble never runs off either edge of the viewport.
      const half = 160; // half of the 320px max width
      const margin = 8;
      const vw = window.innerWidth;
      const center = r.left + r.width / 2;
      const left = Math.max(half + margin, Math.min(center, vw - half - margin));
      setPos({ top: r.bottom + 6, left });
    }, delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setPos(null);
  }, []);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  return (
    <span
      ref={triggerRef}
      className={className}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {pos && text && createPortal(
        <div
          role="tooltip"
          className="fixed z-[999999] px-2.5 py-1.5 bg-white text-black text-xs font-medium rounded-lg border border-gray-200 shadow-xl max-w-[320px] whitespace-pre-line break-words pointer-events-none animate-[tooltipIn_0.15s_ease-out_forwards]"
          style={{ top: pos.top, left: pos.left }}
        >
          {text}
        </div>,
        document.body
      )}
    </span>
  );
};

export default Tooltip;
