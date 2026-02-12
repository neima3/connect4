import Connect4Game from '@/components/Connect4Game'

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-5xl font-bold text-gray-800 mb-2 animate-drop-in">
          Connect 4
        </h1>
        <p className="text-xl text-gray-600 animate-slide-up">
          Challenge friends or play against AI
        </p>
      </div>
      
      <Connect4Game />
    </main>
  )
}