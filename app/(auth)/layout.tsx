import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "CleanManager - Authentication",
  description: "Sign in or create an account",
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen">
      {children}
    </div>
  )
}

