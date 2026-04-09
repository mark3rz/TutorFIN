import { useState } from 'react'
import PixelButton from '../PixelButton'

interface FillBlankCardProps {
  sentence: string
  onSubmit: (answer: string) => void
  disabled?: boolean
}

const ACCENT_CHARS = ['é', 'è', 'ê', 'ë', 'à', 'â', 'ù', 'û', 'ç', 'ô', 'î']

export default function FillBlankCard({
  sentence,
  onSubmit,
  disabled = false
}: FillBlankCardProps) {
  const [answer, setAnswer] = useState('')

  const handleSubmit = () => {
    if (!answer.trim() || disabled) return
    onSubmit(answer.trim())
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit()
    }
  }

  const insertAccent = (char: string) => {
    setAnswer(prev => prev + char)
  }

  // Render sentence with ___ as visible underline gap
  const renderSentence = () => {
    return sentence.split('___').map((part, index, arr) => (
      <span key={index}>
        {part}
        {index < arr.length - 1 && (
          <span className="inline-block border-b-2 border-pet-accent w-16 mx-1" />
        )}
      </span>
    ))
  }

  return (
    <div className="w-full max-w-md mx-auto p-4 space-y-4">
      <div className="bg-pet-panel border-3 border-pet-text p-3">
        <p className="font-pixel text-[8px] text-pet-text leading-relaxed">
          {renderSentence()}
        </p>
      </div>

      <div className="space-y-2">
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={disabled}
          placeholder="Your answer..."
          className="
            w-full font-pixel text-[7px] text-pet-text
            bg-pet-bg border-3 border-pet-text-dim
            px-3 py-2
            focus:outline-none focus:border-pet-accent
            disabled:opacity-50
          "
        />

        <div className="flex flex-wrap gap-1">
          {ACCENT_CHARS.map((char) => (
            <button
              key={char}
              onClick={() => insertAccent(char)}
              disabled={disabled}
              className="
                font-pixel text-[7px] text-pet-text
                bg-pet-bg-light border-2 border-pet-text-dim
                px-2 py-1
                hover:bg-pet-panel hover:border-pet-text
                active:translate-y-[1px]
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              {char}
            </button>
          ))}
        </div>

        <PixelButton
          onClick={handleSubmit}
          disabled={disabled || !answer.trim()}
          className="w-full"
        >
          Submit Answer
        </PixelButton>
      </div>
    </div>
  )
}
