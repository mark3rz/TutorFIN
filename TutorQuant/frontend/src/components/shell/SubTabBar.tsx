"use client";

interface SubTabBarProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function SubTabBar({ tabs, activeTab, onTabChange }: SubTabBarProps) {
  return (
    <div className="flex items-center gap-1 border-b border-[var(--border-color)] bg-[var(--bg-primary)] px-4">
      {tabs.map((tab) => {
        const isActive = tab === activeTab;
        return (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`relative px-4 py-2.5 text-xs font-medium transition-colors duration-150 ${
              isActive
                ? "text-[var(--accent-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {tab}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--accent-primary)]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
