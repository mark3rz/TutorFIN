import { useState } from 'react'

interface ErrorCorrectionCardProps {
  incorrectSentence: string
  options: string[]
  onSubmit: (index: number) => void
  disabled?: boolean
}

export default function ErrorCorrectionCard({
  incorrectSentence,
  options,
  onSubmit,
  disabled = false
}: ErrorCorrectionCardProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const handleSelect = (index: number) => {
    if (disabled) return
    setSelectedIndex(index)
    onSubmit(index)
  }

  return (
    <div className="w-full max-w-md mx-auto p-4 space-y-4">
      <div className="text-center mb-2">
        <h3 className="font-pixel text-[8px] text-pet-red">
          Find and fix the error:
        </h3>
      </div>

      <div className="bg-pet-panel border-3 border-pet-red p-3">
        <p className="font-pixel text-[8px] text-pet-text leading-relaxed underline decoration-pet-red decoration-wavy">
          {incorrectSentence}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleSelect(index)}
            disabled={disabled}
            className={`
              font-pixel text-[7px] text-pet-text
              bg-pet-bg-light border-3
              px-3 py-2 text-left
              transition-all duration-100
              ${selectedIndex === index
                ? 'border-pet-accent bg-pet-accent/20'
                : 'border-pet-text-dim hover:border-pet-text hover:bg-pet-panel'
              }
              ${disabled
                ? 'opacity-50 cursor-not-allowed'
                : 'cursor-pointer active:translate-y-[1px]'
              }
            `}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}
