"use client";

import { useState } from "react";
import { InlineMath, MathBlock } from "@/components/ui/MathBlock";
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Zap,
  Target,
  Shield,
  Gauge,
  Wrench,
  Building2,
} from "lucide-react";

export interface ModelData {
  id: string;
  name: string;
  category: string;
  formula: string;
  process: string;
  assumptions: string[];
  suitable_instruments: string[];
  strengths: string[];
  weaknesses: string[];
  calibration_burden: string;
  computational_cost: string;
  desk_usage: string;
  failure_modes: string[];
  fragility_warning: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  option: "text-[#ff9800] border-[#ff9800]/30 bg-[#ff9800]/10",
  rate: "text-[#2196f3] border-[#2196f3]/30 bg-[#2196f3]/10",
  volatility: "text-[#9c27b0] border-[#9c27b0]/30 bg-[#9c27b0]/10",
  fixed_income: "text-[#4caf50] border-[#4caf50]/30 bg-[#4caf50]/10",
  swap: "text-[#00bcd4] border-[#00bcd4]/30 bg-[#00bcd4]/10",
};

const CATEGORY_LABELS: Record<string, string> = {
  option: "Option",
  rate: "Rate",
  volatility: "Vol",
  fixed_income: "Fixed Income",
  swap: "Swap",
};

interface ModelCardProps {
  model: ModelData;
  onSelect?: (id: string) => void;
  isSelected?: boolean;
}

function DetailSection({
  title,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-[var(--border-color)]">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
      >
        {icon}
        <span className="flex-1">{title}</span>
        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

function BulletList({
  items,
  color = "text-[var(--text-secondary)]",
}: {
  items: string[];
  color?: string;
}) {
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className={`text-[10px] leading-relaxed ${color} flex gap-1.5`}>
          <span className="mt-1 shrink-0 text-[6px]">●</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function ModelCard({ model, onSelect, isSelected }: ModelCardProps) {
  const [expanded, setExpanded] = useState(false);
  const catColor = CATEGORY_COLORS[model.category] ?? "text-[var(--text-muted)] border-[var(--border-color)] bg-[var(--bg-secondary)]";

  return (
    <div
      className={`rounded-lg border bg-[var(--bg-card)] transition-all duration-150 ${
        isSelected
          ? "border-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)]/30"
          : "border-[var(--border-color)] hover:border-[var(--text-muted)]"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between p-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3
              className="text-sm font-semibold text-[var(--text-primary)] cursor-pointer hover:text-[var(--accent-primary)]"
              onClick={() => onSelect?.(model.id)}
            >
              {model.name}
            </h3>
            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase ${catColor}`}>
              {CATEGORY_LABELS[model.category] ?? model.category}
            </span>
          </div>

          {/* Process / SDE */}
          <div className="mt-2 rounded border border-[var(--border-color)] bg-[#0a0a0f] px-3 py-2 overflow-x-auto">
            <MathBlock tex={model.process} />
          </div>

          {/* Key formula */}
          <div className="mt-2 rounded border border-[var(--border-color)] bg-[#0a0a0f] px-3 py-2 overflow-x-auto">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-semibold uppercase text-[var(--text-muted)] shrink-0">Price:</span>
              <MathBlock tex={model.formula} />
            </div>
          </div>

          {/* Quick stats row */}
          <div className="mt-3 flex flex-wrap gap-2">
            <div className="flex items-center gap-1 rounded border border-[var(--border-color)] bg-[var(--bg-secondary)] px-2 py-1">
              <Wrench size={10} className="text-[var(--text-muted)]" />
              <span className="text-[9px] text-[var(--text-secondary)]">{model.calibration_burden}</span>
            </div>
            <div className="flex items-center gap-1 rounded border border-[var(--border-color)] bg-[var(--bg-secondary)] px-2 py-1">
              <Gauge size={10} className="text-[var(--text-muted)]" />
              <span className="text-[9px] text-[var(--text-secondary)]">{model.computational_cost}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Expand/collapse toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-center gap-1 border-t border-[var(--border-color)] px-4 py-1.5 text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors"
      >
        {expanded ? "Collapse" : "Show Details"}
        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
      </button>

      {/* Expanded detail sections */}
      {expanded && (
        <div>
          <DetailSection
            title="Assumptions"
            icon={<Target size={10} className="text-[#2196f3]" />}
            defaultOpen
          >
            <BulletList items={model.assumptions} />
          </DetailSection>

          <DetailSection
            title="Suitable Instruments"
            icon={<Building2 size={10} className="text-[#4caf50]" />}
          >
            <BulletList items={model.suitable_instruments} />
          </DetailSection>

          <DetailSection
            title="Strengths"
            icon={<CheckCircle2 size={10} className="text-[var(--accent-green)]" />}
          >
            <BulletList items={model.strengths} color="text-[var(--accent-green)]" />
          </DetailSection>

          <DetailSection
            title="Weaknesses"
            icon={<XCircle size={10} className="text-[var(--accent-red)]" />}
          >
            <BulletList items={model.weaknesses} color="text-[var(--accent-red)]" />
          </DetailSection>

          <DetailSection
            title="Why Desks Use This Model"
            icon={<Building2 size={10} className="text-[#ff9800]" />}
          >
            <p className="text-[10px] leading-relaxed text-[var(--text-secondary)]">
              {model.desk_usage}
            </p>
          </DetailSection>

          <DetailSection
            title="Failure Modes"
            icon={<AlertTriangle size={10} className="text-[var(--accent-red)]" />}
          >
            <BulletList items={model.failure_modes} color="text-[var(--accent-red)]" />
          </DetailSection>

          <DetailSection
            title="Fragility Warning"
            icon={<Shield size={10} className="text-[#ff5722]" />}
          >
            <div className="rounded border border-[var(--accent-red)]/20 bg-[var(--accent-red)]/5 px-3 py-2">
              <p className="text-[10px] leading-relaxed text-[var(--accent-red)]">
                {model.fragility_warning}
              </p>
            </div>
          </DetailSection>
        </div>
      )}
    </div>
  );
}
