// src/app/layout.tsx
import React from "react";
import "../app/globals.css";

export const metadata = {
  title: "Génesis — Dashboard",
  description: "Sistema Génesis con interfaz modular limpia estilo Fina."
};

export default function SrcRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="light">
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
