"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, BookOpen } from "lucide-react";

interface TheoryPanelProps {
  title: string;
  children: React.ReactNode;
}

export function TheoryPanel({ title, children }: TheoryPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-8 w-8 items-center justify-center rounded border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)] transition-colors hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
        title={isOpen ? "Collapse theory panel" : "Expand theory panel"}
      >
        {isOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="w-[320px] shrink-0 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-[var(--border-color)] px-4 py-3">
            <BookOpen size={14} className="text-[var(--accent-primary)]" />
            <h3 className="text-xs font-semibold text-[var(--text-primary)]">
              {title}
            </h3>
          </div>

          {/* Content */}
          <div className="overflow-y-auto p-4" style={{ maxHeight: "calc(100vh - 200px)" }}>
            {/* KaTeX rendering placeholder */}
            <div className="theory-content space-y-3">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}
