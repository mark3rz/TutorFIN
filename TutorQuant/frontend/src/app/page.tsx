import Link from "next/link";
import {
  LineChart,
  Activity,
  BarChart3,
  Briefcase,
  Landmark,
  TrendingUp,
  ArrowLeftRight,
  BookOpen,
} from "lucide-react";

const modules = [
  {
    title: "Option Modeling",
    description:
      "Price options using Black-Scholes, Binomial, and Monte Carlo methods. Visualize payoff diagrams and compare models.",
    href: "/option-modeling",
    icon: LineChart,
    phase: "Phase 1",
  },
  {
    title: "Volatility Lab",
    description:
      "Explore implied volatility, smile and skew dynamics, volatility surfaces, and term structure analysis.",
    href: "/volatility-lab",
    icon: Activity,
    phase: "Phase 2",
  },
  {
    title: "Greeks & P&L",
    description:
      "Compute option Greeks, decompose P&L, run scenario analysis, and design hedging strategies.",
    href: "/greeks",
    icon: BarChart3,
    phase: "Phase 1",
  },
  {
    title: "Portfolio Analytics",
    description:
      "Manage positions, calculate risk metrics, estimate VaR and Expected Shortfall, and stress test portfolios.",
    href: "/portfolio",
    icon: Briefcase,
    phase: "Phase 2",
  },
  {
    title: "Fixed Income",
    description:
      "Price bonds, build yield curves, and analyze duration, convexity, and other fixed income risk measures.",
    href: "/fixed-income",
    icon: Landmark,
    phase: "Phase 3",
  },
  {
    title: "Interest Rate Models",
    description:
      "Simulate short rate models (Vasicek, CIR, Hull-White), compare dynamics, and calibrate to market data.",
    href: "/rates",
    icon: TrendingUp,
    phase: "Phase 3",
  },
  {
    title: "Swaps",
    description:
      "Price interest rate swaps, overnight indexed swaps, and construct swap curves from market data.",
    href: "/swaps",
    icon: ArrowLeftRight,
    phase: "Phase 4",
  },
  {
    title: "Model Encyclopedia",
    description:
      "Browse the complete reference of quantitative models with formulas, derivations, and implementation notes.",
    href: "/encyclopedia",
    icon: BookOpen,
    phase: "Phase 4",
  },
];

export default function HomePage() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
          TutorQuant Terminal
        </h1>
        <p className="text-lg text-[var(--text-secondary)]">
          Interactive quantitative finance research and learning platform.
          Explore pricing models, risk analytics, and portfolio tools.
        </p>
      </div>

      {/* Module Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <Link
              key={mod.href}
              href={mod.href}
              className="group block rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-5 transition-all duration-200 hover:border-[var(--border-active)] hover:bg-[var(--bg-hover)]"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--bg-hover)] group-hover:bg-[var(--accent-primary)]/10">
                  <Icon
                    size={20}
                    className="text-[var(--accent-primary)]"
                  />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)]">
                    {mod.title}
                  </h2>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                    {mod.phase}
                  </span>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                {mod.description}
              </p>
            </Link>
          );
        })}
      </div>

      {/* Status Bar */}
      <div className="mt-10 flex items-center gap-4 rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2 text-xs text-[var(--text-muted)]">
        <span>STATUS: READY</span>
        <span className="h-3 w-px bg-[var(--border-color)]" />
        <span>API: localhost:8000</span>
        <span className="h-3 w-px bg-[var(--border-color)]" />
        <span>SESSION: active</span>
        <span className="ml-auto flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-green)]" />
          Connected
        </span>
      </div>
    </div>
  );
}
