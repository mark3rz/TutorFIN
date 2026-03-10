"use client";

import { useEffect, useRef } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface MathBlockProps {
  /** LaTeX math expression */
  tex: string;
  /** Display mode (centered block) vs inline */
  display?: boolean;
  /** Additional CSS class */
  className?: string;
}

/**
 * Renders a LaTeX expression using KaTeX.
 *
 * Display mode (default): centered block equation.
 * Inline mode: rendered inline within text.
 */
export function MathBlock({ tex, display = true, className = "" }: MathBlockProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (ref.current) {
      try {
        katex.render(tex, ref.current, {
          displayMode: display,
          throwOnError: false,
          trust: true,
          strict: false,
        });
      } catch {
        if (ref.current) {
          ref.current.textContent = tex;
        }
      }
    }
  }, [tex, display]);

  return (
    <span
      ref={ref}
      className={`${display ? "math-display block my-2" : "math-inline"} ${className}`}
    />
  );
}

/**
 * Inline math convenience component.
 */
export function InlineMath({ tex, className = "" }: { tex: string; className?: string }) {
  return <MathBlock tex={tex} display={false} className={className} />;
}
