'use client'

import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t bg-background py-4 px-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
        <p>© 2025 EngiSuite Analytics. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <Link href="#" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
          <Link href="#" className="hover:text-foreground transition-colors">
            Terms
          </Link>
          <Link href="#" className="hover:text-foreground transition-colors">
            Contact
          </Link>
        </div>
      </div>
    </footer>
  )
}
