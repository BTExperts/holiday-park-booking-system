import React from 'react'
import clsx from './utils/clsx'

export function Card({ className = '', ...props }) {
  return (
    <div 
      className={clsx(
        'rounded-xl border border-slate-200 bg-white shadow-sm',
        className
      )} 
      {...props} 
    />
  )
}

export function CardContent({ className = '', ...props }) {
  return (
    <div 
      className={clsx('p-6', className)} 
      {...props} 
    />
  )
}

export function CardHeader({ className = '', ...props }) {
  return (
    <div 
      className={clsx('flex flex-col space-y-1.5 p-6', className)} 
      {...props} 
    />
  )
}

export function CardTitle({ className = '', ...props }) {
  return (
    <h3 
      className={clsx('text-2xl font-semibold leading-none tracking-tight', className)} 
      {...props} 
    />
  )
}

export function CardDescription({ className = '', ...props }) {
  return (
    <p 
      className={clsx('text-sm text-slate-500', className)} 
      {...props} 
    />
  )
}

export function CardFooter({ className = '', ...props }) {
  return (
    <div 
      className={clsx('flex items-center p-6 pt-0', className)} 
      {...props} 
    />
  )
}

export default Card