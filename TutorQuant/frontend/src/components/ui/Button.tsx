"use client";

import { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}

export function Button({
  children,
  onClick,
  variant = "primary",
  loading = false,
  disabled = false,
  className = "",
  type = "button",
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const baseStyles =
    "inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors duration-100 focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]";

  const variantStyles =
    variant === "primary"
      ? "bg-[var(--accent-primary)] text-[#0a0a0f] hover:bg-[var(--accent-secondary)] active:bg-[#e65100]"
      : "border border-[var(--border-color)] bg-[#0e0e14] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]";

  const disabledStyles = isDisabled ? "cursor-not-allowed opacity-50" : "";

  return (
    <button
      type={type}
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      className={`${baseStyles} ${variantStyles} ${disabledStyles} ${className}`}
    >
      {loading && (
        <svg
          className="h-3.5 w-3.5 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
