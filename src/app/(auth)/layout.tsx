import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-4">
      <ThemeToggle className="absolute top-4 right-4" />
      <Logo />
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
