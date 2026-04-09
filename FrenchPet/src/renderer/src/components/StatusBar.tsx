interface StatusBarProps {
  label: string
  icon: string
  value: number
  maxValue?: number
  color: string
}

function getBarColor(value: number, defaultColor: string): string {
  if (value <= 20) return 'bg-pet-red'
  if (value <= 40) return 'bg-pet-orange'
  return defaultColor
}

export default function StatusBar({ label, icon, value, maxValue = 100, color }: StatusBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / maxValue) * 100))
  const barColor = getBarColor(value, color)

  return (
    <div className="flex items-center gap-2 w-full">
      <span className="text-[10px] w-5 text-center">{icon}</span>
      <span className="font-pixel text-[6px] text-pet-text-dim w-10 text-right">{label}</span>
      <div className="flex-1 h-3 bg-pet-bg border border-pet-panel relative overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
        {/* Pixel grid overlay */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'repeating-linear-gradient(90deg, transparent 0px, transparent 3px, #1a1a2e 3px, #1a1a2e 4px)',
          }}
        />
      </div>
      <span className="font-pixel text-[6px] text-pet-text-dim w-8 text-right">
        {value}
      </span>
    </div>
  )
}
