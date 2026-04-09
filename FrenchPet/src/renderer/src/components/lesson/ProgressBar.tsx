interface ProgressBarProps {
  current: number
  total: number
}

export default function ProgressBar({ current, total }: ProgressBarProps) {
  const percentage = Math.min((current / total) * 100, 100)

  return (
    <div className="w-full h-[8px] border-2 border-pet-text bg-pet-bg relative">
      <div
        className="h-full bg-pet-accent transition-all duration-300"
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}
