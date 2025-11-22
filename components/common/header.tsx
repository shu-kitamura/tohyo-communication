import * as React from "react"

function Header () {
  return (
    <header className="w-full border-b bg-background/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="mx-auto h-16 max-w-4xl flex items-center px-4 sm:px-6 lg:px-8 dark:bg-indigo-900">
        <h1 className="text-lg font-semibold text-foreground">TOHYO通信 ~Vote Communication~</h1>
      </div>
    </header>
  )
} 

export { Header }
