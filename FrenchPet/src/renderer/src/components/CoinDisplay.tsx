import { usePet } from '../context/PetContext'

export default function CoinDisplay() {
  const { petState } = usePet()

  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-block w-4 h-4 rounded-full bg-pet-gold border border-yellow-600 shadow-[1px_1px_0_rgba(0,0,0,0.3)]" />
      <span className="font-pixel text-[8px] text-pet-gold">
        {petState?.coins ?? 0}
      </span>
    </div>
  )
}
