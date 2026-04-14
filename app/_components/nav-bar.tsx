"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Home,
  Users,
  FileText,
  Phone,
  FolderOpen,
  UserCog,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlobalSearchTrigger, GlobalSearchMobileTrigger } from "./global-search-trigger";

const NAV_LINKS = [
  { href: "/", label: "首頁", icon: Home },
  { href: "/clients", label: "族人", icon: Users },
  { href: "/cases", label: "案件", icon: FileText },
  { href: "/contacts", label: "通聯紀錄", icon: Phone },
  { href: "/files", label: "文件", icon: FolderOpen },
  { href: "/staff", label: "員工管理", icon: UserCog },
] as const;

export function NavBar() {
  const { status, data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="bg-card shadow-sm border-b border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          {/* Brand */}
          <Link href="/" className="text-base font-semibold text-foreground shrink-0">
            原民 CRM
          </Link>

          {/* Desktop nav links */}
          <div className="hidden lg:flex lg:items-center lg:gap-1">
            {NAV_LINKS.map((link) => {
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : pathname === link.href || pathname.startsWith(link.href + "/");

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition-colors inline-flex items-center gap-1.5",
                    isActive
                      ? "bg-muted text-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <link.icon className="size-4" />
                  {link.label}
                </Link>
              );
            })}
            {isAdmin && (
              <Link
                href="/admin/deletion-requests"
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors inline-flex items-center gap-1.5",
                  pathname.startsWith("/admin/deletion-requests")
                    ? "bg-muted text-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <ShieldCheck className="size-4" />
                刪除審核
              </Link>
            )}
          </div>

          {/* Global search trigger (desktop) */}
          <GlobalSearchTrigger />

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
            {NAV_LINKS.map((link) => {
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : pathname === link.href || pathname.startsWith(link.href + "/");

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-muted text-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  onClick={() => setMenuOpen(false)}
                >
                  <link.icon className="size-4" />
                  {link.label}
                </Link>
              );
            })}
            {/* Mobile search trigger */}
            <GlobalSearchMobileTrigger onAfterClick={() => setMenuOpen(false)} />
            {isAdmin && (
              <Link
                href="/admin/deletion-requests"
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  pathname.startsWith("/admin/deletion-requests")
                    ? "bg-muted text-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                onClick={() => setMenuOpen(false)}
              >
                <ShieldCheck className="size-4" />
                刪除審核
              </Link>
            )}
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
