# Connect 4

A modern, beautiful Connect 4 game built with Next.js, TypeScript, and Tailwind CSS.

## Features

- 🎮 Play locally with a friend
- 🤖 Play against the computer (AI)
- 🌐 Play online with shared room codes (coming soon)
- 📱 Fully responsive design for mobile and desktop
- ✨ Beautiful animations with Framer Motion
- 🎨 Modern UI with Tailwind CSS
- ♿ Accessible with keyboard navigation and ARIA labels
- 📖 Built-in help section with game instructions

## Tech Stack

- **Next.js 16+** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **Lucide React** for icons
- **React** with modern hooks

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/neima3/connect4.git
   cd connect4
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open your browser and navigate to [http://localhost:4002](http://localhost:4002)

## Game Modes

### Local Two Players

Two players take turns on the same device to play Connect 4.

### Play vs Computer

Challenge the AI opponent in single-player mode.

### Play Online

Create a room with a unique code or join an existing room to play with friends remotely.

## How to Play

1. The game starts with an empty 7x6 grid
2. Players take turns dropping colored discs into columns
3. The disc falls to the lowest available position in the chosen column
4. The first player to connect four of their discs horizontally, vertically, or diagonally wins
5. If the board fills up with no winner, the game is a draw

## Controls

- **Mouse/Touch**: Click on any column to drop your disc
- **Keyboard**: Use number keys 1-7 to select columns

## Development

### Available Scripts

- `npm run dev` - Start development server on port 4002
- `npm run build` - Build production version
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run type-check` - Run TypeScript type checking
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

### Project Structure

```
src/
├── app/              # Next.js app directory
│   ├── globals.css   # Global styles
│   ├── layout.tsx    # Root layout
│   └── page.tsx      # Home page
├── components/       # React components
│   ├── board.tsx     # Game board component
│   ├── game.tsx      # Main game component
│   └── help.tsx      # Help modal component
├── types/           # TypeScript type definitions
│   └── game.ts
├── hooks/           # Custom React hooks
│   └── use-game-state.ts
└── lib/             # Utility functions
    ├── utils.ts     # Utility functions
    └── game-logic.ts # Game logic
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the ISC License.
