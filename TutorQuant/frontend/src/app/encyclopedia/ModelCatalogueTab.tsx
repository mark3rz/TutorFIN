"use client";

import { useState, useEffect, useMemo } from "react";
import { ModelCard, ModelData } from "./ModelCard";
import { api } from "@/lib/api";

interface ModelCatalogueTabProps {
  categoryFilter?: string;
  onSelectModel?: (id: string) => void;
  selectedModelId?: string;
}

export function ModelCatalogueTab({
  categoryFilter,
  onSelectModel,
  selectedModelId,
}: ModelCatalogueTabProps) {
  const [models, setModels] = useState<ModelData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .getEncyclopediaModels(categoryFilter)
      .then((res) => {
        if (!cancelled) {
          setModels(res.models);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load models");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [categoryFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return models;
    const q = search.toLowerCase();
    return models.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.desk_usage.toLowerCase().includes(q) ||
        m.suitable_instruments.some((s) => s.toLowerCase().includes(q))
    );
  }, [models, search]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-sm text-[var(--text-muted)]">Loading models...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="rounded border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 px-4 py-3 text-sm text-[var(--accent-red)]">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-hidden">
      {/* Search bar */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search models by name, instrument, or use case..."
          className="flex-1 rounded-md border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
        />
        <span className="text-[10px] text-[var(--text-muted)]">
          {filtered.length} model{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Model cards grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 pb-4">
          {filtered.map((model) => (
            <ModelCard
              key={model.id}
              model={model}
              onSelect={onSelectModel}
              isSelected={selectedModelId === model.id}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-[var(--text-muted)]">
              No models match your search.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
