import React from 'react'
import clsx from './utils/clsx'

const variants = {
  default: 'bg-slate-900 text-white hover:bg-slate-700 hover:scale-105 transition-all duration-200',
  outline: 'border border-slate-300 bg-white hover:bg-slate-100 hover:border-slate-400 hover:scale-105 transition-all duration-200',
  secondary: 'bg-slate-100 hover:bg-slate-200',
  destructive: 'bg-red-600 text-white hover:bg-red-700 hover:scale-105 transition-all duration-200'
}

const sizes = {
  sm: 'h-8 px-2 text-sm',
  md: 'h-10 px-3',
  lg: 'h-12 px-4 text-lg'
}

export const Button = React.forwardRef(({ 
  variant = 'default', 
  size = 'md', 
  className = '', 
  disabled = false,
  ...props 
}, ref) => {
  return (
    <button 
      ref={ref} 
      disabled={disabled}
      className={clsx(
        'rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
        variants[variant] || variants.default,
        sizes[size] || sizes.md,
        className
      )} 
      {...props}
    />
  )
})

Button.displayName = 'Button'

export default Button