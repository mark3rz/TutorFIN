import { useState } from 'react'
import type { ComprehensibleInput } from '../../types/lesson'
import PixelButton from '../PixelButton'

interface ComprehensibleInputViewProps {
  input: ComprehensibleInput
  onContinue: () => void
}

export default function ComprehensibleInputView({
  input,
  onContinue
}: ComprehensibleInputViewProps) {
  const [showTranslation, setShowTranslation] = useState(false)

  return (
    <div className="flex items-center justify-center min-h-screen bg-pet-bg p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="bg-pet-panel border-3 border-pet-text p-4 space-y-4">
          <h2 className="font-pixel text-[10px] text-pet-accent text-center">
            {input.title}
          </h2>

          <div className="bg-pet-bg border-2 border-pet-text-dim p-4">
            <p className="font-pixel text-[9px] text-pet-text leading-relaxed">
              {input.frenchText}
            </p>
          </div>

          <div>
            <h3 className="font-pixel text-[7px] text-pet-text-dim mb-2">
              Vocabulary:
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {input.vocabularyHighlights.map((item, index) => (
                <div
                  key={index}
                  className="bg-pet-bg-light border-2 border-pet-text-dim p-2"
                >
                  <div className="font-pixel text-[7px] text-pet-accent">
                    {item.french}
                  </div>
                  <div className="font-pixel text-[6px] text-pet-text-dim">
                    {item.english}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <PixelButton
              variant="secondary"
              onClick={() => setShowTranslation(!showTranslation)}
              className="w-full"
            >
              {showTranslation ? 'Hide Translation' : 'Show Translation'}
            </PixelButton>

            {showTranslation && (
              <div className="bg-pet-bg border-2 border-pet-blue p-3 animate-in slide-in-from-top duration-200">
                <p className="font-pixel text-[7px] text-pet-text-dim leading-relaxed">
                  {input.englishHint}
                </p>
              </div>
            )}
          </div>

          <PixelButton onClick={onContinue} className="w-full">
            I've read it → Practice!
          </PixelButton>
        </div>
      </div>
    </div>
  )
}
