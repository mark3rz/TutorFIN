import type { ButtonHTMLAttributes } from 'react'

interface PixelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md'
}

const variantStyles = {
  primary: 'bg-pet-panel border-pet-blue text-pet-text hover:bg-pet-blue/30 active:bg-pet-blue/50',
  secondary: 'bg-pet-bg-light border-pet-text-dim text-pet-text-dim hover:bg-pet-panel active:bg-pet-bg',
  danger: 'bg-pet-bg-light border-pet-red text-pet-red hover:bg-pet-red/20 active:bg-pet-red/40'
}

const sizeStyles = {
  sm: 'px-2 py-1 text-[6px]',
  md: 'px-3 py-2 text-[8px]'
}

export default function PixelButton({
  children,
  variant = 'primary',
  size = 'md',
  disabled,
  className = '',
  ...props
}: PixelButtonProps) {
  return (
    <button
      className={`
        font-pixel border-3 transition-all duration-100
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${disabled
          ? 'opacity-40 cursor-not-allowed grayscale'
          : 'cursor-pointer active:translate-y-[2px] active:shadow-none shadow-[2px_2px_0_rgba(0,0,0,0.5)]'
        }
        ${className}
      `}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
