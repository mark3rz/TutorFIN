import StatusBar from './StatusBar'
import { usePet } from '../context/PetContext'
import { BAR_CONFIGS } from '../lib/constants'

export default function StatusBars() {
  const { petState } = usePet()

  if (!petState) return null

  return (
    <div className="flex flex-col gap-1.5 w-full px-4">
      {BAR_CONFIGS.map((bar) => (
        <StatusBar
          key={bar.key}
          label={bar.label}
          icon={bar.icon}
          value={petState[bar.key as keyof typeof petState] as number}
          color={bar.color}
        />
      ))}
    </div>
  )
}
