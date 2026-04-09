import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/renderer/src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace']
      },
      colors: {
        'pet-bg': '#1a1a2e',
        'pet-bg-light': '#16213e',
        'pet-panel': '#0f3460',
        'pet-accent': '#e94560',
        'pet-gold': '#f5c518',
        'pet-green': '#4ade80',
        'pet-red': '#ef4444',
        'pet-blue': '#60a5fa',
        'pet-purple': '#a78bfa',
        'pet-yellow': '#fbbf24',
        'pet-orange': '#fb923c',
        'pet-text': '#e2e8f0',
        'pet-text-dim': '#94a3b8'
      },
      borderWidth: {
        '3': '3px'
      }
    }
  },
  plugins: []
}

export default config
