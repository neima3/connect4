'use client'

export default function GameControls({ 
  onStartAI, 
  onStartLocal, 
  onStartOnline 
}: {
  onStartAI: () => void
  onStartLocal: () => void
  onStartOnline: () => void
}) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-8 max-w-md mx-auto animate-slide-up">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
        Choose Game Mode
      </h2>
      
      <div className="space-y-4">
        <button
          onClick={onStartLocal}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 transform hover:scale-105"
        >
          🎮 Local Two Players
        </button>
        
        <button
          onClick={onStartAI}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 transform hover:scale-105"
        >
          🤖 Play vs Computer
        </button>
        
        <button
          onClick={onStartOnline}
          className="w-full bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 transform hover:scale-105"
        >
          🌐 Play Online
        </button>
      </div>
      
      <div className="mt-6 text-center">
        <button className="text-blue-600 hover:text-blue-800 font-medium">
          ℹ️ How to Play
        </button>
      </div>
    </div>
  )
}