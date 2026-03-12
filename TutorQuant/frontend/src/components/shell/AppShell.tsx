"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LineChart,
  Activity,
  BarChart3,
  Briefcase,
  Landmark,
  TrendingUp,
  ArrowLeftRight,
  SlidersHorizontal,
  BookOpen,
  Terminal,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
}

const navItems: NavItem[] = [
  { label: "Option Modeling", href: "/option-modeling", icon: LineChart },
  { label: "Volatility Lab", href: "/volatility-lab", icon: Activity },
  { label: "Greeks & P&L", href: "/greeks", icon: BarChart3 },
  { label: "Portfolio", href: "/portfolio", icon: Briefcase },
  { label: "Fixed Income", href: "/fixed-income", icon: Landmark },
  { label: "Rates", href: "/rates", icon: TrendingUp },
  { label: "Swaps", href: "/swaps", icon: ArrowLeftRight },
  { label: "Calibration", href: "/calibration", icon: SlidersHorizontal },
  { label: "Encyclopedia", href: "/encyclopedia", icon: BookOpen },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="flex w-[220px] flex-col border-r border-[var(--border-color)] bg-[#0a0a0f]">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 border-b border-[var(--border-color)] px-4 py-4"
        >
          <Terminal size={20} className="text-[var(--accent-primary)]" />
          <span className="text-sm font-bold tracking-wide text-[var(--text-primary)]">
            TutorQuant
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3">
          <ul className="space-y-0.5 px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                pathname.startsWith(item.href + "/");

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors duration-150 ${
                      isActive
                        ? "bg-[var(--bg-hover)] text-[var(--accent-primary)] border-l-2 border-[var(--accent-primary)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <Icon
                      size={16}
                      className={
                        isActive
                          ? "text-[var(--accent-primary)]"
                          : "text-[var(--text-muted)]"
                      }
                    />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-[var(--border-color)] px-4 py-3">
          <p className="text-[10px] text-[var(--text-muted)]">
            TutorQuant v0.1.0
          </p>
          <p className="text-[10px] text-[var(--text-muted)]">
            Quant Research Terminal
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-[#0e0e14]">{children}</main>
    </div>
  );
}
