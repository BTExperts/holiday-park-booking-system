import React from 'react'
export function Dialog({open,onOpenChange,children}){return <div data-open={!!open}>{open&&children}</div>}
export function DialogContent({className='', style={}, children}){
  const topValue = Object.prototype.hasOwnProperty.call(style,'top') ? style.top : '2.5rem';
  const mergedStyle = { ...style, top: topValue };
  return (
    <div className="fixed inset-0 z-[9000]">
      <div className="absolute inset-0 bg-black/40"></div>
      <div className={`absolute left-1/2 -translate-x-1/2 bg-white border rounded-xl shadow-2xl p-4 ${className}`} style={mergedStyle}>{children}</div>
    </div>
  )
}
export function DialogHeader({children}){return <div className="px-4 pt-4">{children}</div>}
export function DialogTitle({children}){return <div className="text-lg font-semibold">{children}</div>}
export function DialogFooter({children}){return <div className="px-4 py-4 flex justify-end gap-2">{children}</div>}