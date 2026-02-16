import * as React from "react";

function Header() {
  return (
    <header className="w-full h-16 border-b bg-background/50 backdrop-blur-sm sticky top-0 z-50">
      <h1 className="h-full text-base font-semibold tracking-tight text-foreground text-lg md:text-2xl flex items-center justify-center">
        TOHYO通信 ~Vote Communication~
      </h1>
    </header>
  );
}

export { Header };
