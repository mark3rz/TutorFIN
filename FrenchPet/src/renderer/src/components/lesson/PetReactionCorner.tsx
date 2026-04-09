interface PetReactionCornerProps {
  reaction: 'neutral' | 'happy' | 'sad'
}

const reactionConfig = {
  happy: {
    emoji: '😊',
    bgClass: 'bg-pet-green/20 animate-pulse'
  },
  sad: {
    emoji: '😢',
    bgClass: 'bg-pet-red/20 animate-pulse'
  },
  neutral: {
    emoji: '🐱',
    bgClass: 'bg-pet-panel'
  }
}

export default function PetReactionCorner({ reaction }: PetReactionCornerProps) {
  const config = reactionConfig[reaction]

  return (
    <div
      className={`
        fixed bottom-4 right-4 w-12 h-12
        flex items-center justify-center
        border-2 border-pet-text
        ${config.bgClass}
        transition-all duration-300
        z-50
      `}
    >
      <span className="text-2xl">{config.emoji}</span>
    </div>
  )
}
