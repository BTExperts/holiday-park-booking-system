import React from 'react'
export const Input = React.forwardRef(({className='',...props}, ref) => {
  return <input ref={ref} className={`px-3 border rounded-md border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 ${className}`} {...props}/>
})
export default Input