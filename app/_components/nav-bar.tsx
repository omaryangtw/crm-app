"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/", label: "首頁" },
  { href: "/clients", label: "族人" },
  { href: "/clients/new", label: "新增族人" },
  { href: "/cases", label: "案件" },
  { href: "/cases/new", label: "新增案件" },
  { href: "/contacts", label: "通聯紀錄" },
  { href: "/contacts/recent", label: "久未聯繫" },
  { href: "/files", label: "文件" },
  { href: "/staff", label: "員工管理" },
] as const;

export function NavBar() {
  const { status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="bg-white shadow-sm border-b border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          {/* Brand */}
          <Link href="/" className="text-base font-semibold text-foreground shrink-0">
            原民 CRM
          </Link>

          {/* Desktop nav links */}
          <div className="hidden lg:flex lg:items-center lg:gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Auth buttons (desktop) */}
          <div className="hidden lg:flex lg:items-center lg:gap-2">
            {status === "authenticated" ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                登出
              </Button>
            ) : status === "unauthenticated" ? (
              <>
                <Link
                  href="/register"
                  className="rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  註冊
                </Link>
                <Link
                  href="/login"
                  className="rounded-md bg-primary px-2.5 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
                >
                  登入
                </Link>
              </>
            ) : null}
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            className="lg:hidden inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-label="開啟選單"
          >
            {menuOpen ? (
              <svg className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="lg:hidden border-t border-border">
          <div className="space-y-1 px-4 py-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="border-t border-border px-4 py-3 flex gap-2">
            {status === "authenticated" ? (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                登出
              </Button>
            ) : status === "unauthenticated" ? (
              <>
                <Link
                  href="/register"
                  className="flex-1 text-center rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  註冊
                </Link>
                <Link
                  href="/login"
                  className="flex-1 text-center rounded-md bg-primary px-2.5 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  登入
                </Link>
              </>
            ) : null}
          </div>
        </div>
      )}
    </nav>
  );
}
