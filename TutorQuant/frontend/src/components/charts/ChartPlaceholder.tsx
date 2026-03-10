interface ChartPlaceholderProps {
  title: string;
  height?: string;
}

export function ChartPlaceholder({
  title,
  height = "400px",
}: ChartPlaceholderProps) {
  return (
    <div
      className="flex items-center justify-center rounded-lg border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-card)]"
      style={{ height }}
    >
      <div className="text-center">
        <p className="text-sm font-medium text-[var(--text-muted)]">{title}</p>
        <p className="mt-1 text-xs text-[var(--text-muted)] opacity-60">
          Plotly chart will render here
        </p>
      </div>
    </div>
  );
}
