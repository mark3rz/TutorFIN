import { useState } from 'react'
import { PetProvider } from './context/PetContext'
import PetView from './views/PetView'
import LessonView from './views/LessonView'
import './types/api'

type View = 'pet' | 'lesson'

export default function App() {
  const [currentView, setCurrentView] = useState<View>('pet')

  return (
    <PetProvider>
      <div className="w-full h-screen overflow-hidden">
        {currentView === 'pet' ? (
          <PetView onStartLesson={() => setCurrentView('lesson')} />
        ) : (
          <LessonView onBack={() => setCurrentView('pet')} />
        )}
      </div>
    </PetProvider>
  )
}
