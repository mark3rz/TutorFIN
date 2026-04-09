import PetSprite from '../components/PetSprite'
import StatusBars from '../components/StatusBars'
import ActionButtons from '../components/ActionButtons'
import CoinDisplay from '../components/CoinDisplay'
import { usePet } from '../context/PetContext'
import { EVOLUTION_NAMES } from '../lib/constants'

interface PetViewProps {
  onStartLesson: () => void
}

export default function PetView({ onStartLesson }: PetViewProps) {
  const { petState } = usePet()

  const evolutionName = EVOLUTION_NAMES[petState?.evolution_stage ?? 1] ?? 'Unknown'

  return (
    <div className="flex flex-col items-center h-screen bg-pet-bg p-4 gap-3">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <div>
          <h1 className="font-pixel text-[12px] text-pet-accent">FrenchPet</h1>
          <p className="font-pixel text-[6px] text-pet-text-dim mt-1">
            Stage: {evolutionName}
          </p>
        </div>
        <CoinDisplay />
      </div>

      {/* Divider */}
      <div className="w-full h-[2px] bg-pet-panel" />

      {/* Pet Area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 w-full">
        {/* Pet sprite with background */}
        <div className="relative w-48 h-48 flex items-center justify-center pixel-border bg-pet-bg-light rounded-sm">
          {/* Background grid pattern */}
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: 'radial-gradient(circle, #e2e8f0 1px, transparent 1px)',
              backgroundSize: '8px 8px'
            }}
          />
          <PetSprite />
        </div>

        {/* Status Bars */}
        <div className="w-full max-w-xs">
          <StatusBars />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="w-full max-w-xs pb-2">
        <ActionButtons onStartLesson={onStartLesson} />
      </div>
    </div>
  )
}
