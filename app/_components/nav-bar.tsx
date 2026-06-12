"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Home,
  Users,
  FileText,
  Phone,
  BarChart3,
  Settings,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlobalSearchTrigger, GlobalSearchMobileTrigger } from "./global-search-trigger";

// --- Nav structure ---
// A nav item is either a single link or a group of links shown in a dropdown.

interface NavLink {
  href: string;
  label: string;
}

interface NavGroup {
  label: string;
  icon: LucideIcon;
  children: NavLink[];
}

type NavItem = ({ type: "link"; icon: LucideIcon } & NavLink) | ({ type: "group" } & NavGroup);

const NAV_ITEMS: NavItem[] = [
  { type: "link", href: "/", label: "首頁", icon: Home },
  {
    type: "group",
    label: "族人",
    icon: Users,
    children: [
      { href: "/clients", label: "族人列表" },
      { href: "/clients/birthday", label: "生日清單" },
      { href: "/clients/household-check", label: "戶長檢查" },
    ],
  },
  { type: "link", href: "/cases", label: "案件", icon: FileText },
  {
    type: "group",
    label: "通聯",
    icon: Phone,
    children: [
      { href: "/contacts", label: "通聯紀錄" },
      { href: "/contacts/recent", label: "久未聯絡" },
      { href: "/contacts/no-contact", label: "從未成功聯絡" },
      { href: "/contacts/weekly", label: "近期通聯" },
    ],
  },
  {
    type: "group",
    label: "報表",
    icon: BarChart3,
    children: [{ href: "/performance", label: "績效" }],
  },
];

const ADMIN_GROUP: NavGroup = {
  label: "管理",
  icon: Settings,
  children: [
    { href: "/export", label: "匯入/匯出" },
    { href: "/staff", label: "員工管理" },
    { href: "/admin/deletion-requests", label: "刪除審核" },
    { href: "/admin/backups", label: "備份管理" },
  ],
};

// Collect every leaf href once, so we can resolve the single active link via
// longest-prefix match (avoids /clients also matching /clients/birthday).
const ALL_HREFS: string[] = [
  ...NAV_ITEMS.flatMap((item) =>
    item.type === "link" ? [item.href] : item.children.map((c) => c.href)
  ),
  ...ADMIN_GROUP.children.map((c) => c.href),
];

function matchesPath(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/** The single href that best matches the current path (longest prefix wins). */
function resolveActiveHref(pathname: string): string | null {
  let best: string | null = null;
  for (const href of ALL_HREFS) {
    if (matchesPath(href, pathname) && (best === null || href.length > best.length)) {
      best = href;
    }
  }
  return best;
}

const linkBase =
  "rounded-md px-3 py-2 text-sm font-medium transition-colors inline-flex items-center gap-1.5";
const linkActive = "bg-muted text-foreground font-semibold";
const linkIdle = "text-muted-foreground hover:bg-muted hover:text-foreground";

export function NavBar() {
  const { status, data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const pathname = usePathname();
  const activeHref = resolveActiveHref(pathname);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="bg-card shadow-sm border-b border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          {/* Brand */}
          <Link href="/" className="text-base font-semibold text-foreground shrink-0">
            CRM
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex lg:items-center lg:gap-1">
            {NAV_ITEMS.map((item) =>
              item.type === "link" ? (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(linkBase, item.href === activeHref ? linkActive : linkIdle)}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              ) : (
                <DesktopGroup key={item.label} group={item} activeHref={activeHref} />
              )
            )}
            {isAdmin && <DesktopGroup group={ADMIN_GROUP} activeHref={activeHref} />}
          </div>

          {/* Global search trigger (desktop) */}
          <GlobalSearchTrigger />

          {/* Auth buttons (desktop) */}
          <div className="hidden lg:flex lg:items-center lg:gap-2">
            {status === "authenticated" ? (
              <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/" })}>
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

      {/* Mobile menu — groups expanded inline */}
      {menuOpen && (
        <div className="lg:hidden border-t border-border">
          <div className="space-y-1 px-4 py-3">
            {NAV_ITEMS.map((item) =>
              item.type === "link" ? (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    item.href === activeHref ? linkActive : linkIdle
                  )}
                  onClick={() => setMenuOpen(false)}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              ) : (
                <MobileGroup
                  key={item.label}
                  group={item}
                  activeHref={activeHref}
                  onNavigate={() => setMenuOpen(false)}
                />
              )
            )}
            {/* Mobile search trigger */}
            <GlobalSearchMobileTrigger onAfterClick={() => setMenuOpen(false)} />
            {isAdmin && (
              <MobileGroup
                group={ADMIN_GROUP}
                activeHref={activeHref}
                onNavigate={() => setMenuOpen(false)}
              />
            )}
          </div>
          <div className="border-t border-border px-4 py-3 flex gap-2">
            {status === "authenticated" ? (
              <Button variant="ghost" size="sm" className="w-full" onClick={() => signOut({ callbackUrl: "/" })}>
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

// --- Desktop dropdown group ---

function DesktopGroup({ group, activeHref }: { group: NavGroup; activeHref: string | null }) {
  const groupActive = group.children.some((c) => c.href === activeHref);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<button type="button" className={cn(linkBase, groupActive ? linkActive : linkIdle)} />}
      >
        <group.icon className="size-4" />
        {group.label}
        <ChevronDown className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {group.children.map((child) => (
          <DropdownMenuItem key={child.href}>
            <Link
              href={child.href}
              className={cn("w-full", child.href === activeHref && "font-semibold text-foreground")}
            >
              {child.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// --- Mobile inline group ---

function MobileGroup({
  group,
  activeHref,
  onNavigate,
}: {
  group: NavGroup;
  activeHref: string | null;
  onNavigate: () => void;
}) {
  return (
    <div className="pt-1">
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <group.icon className="size-3.5" />
        {group.label}
      </div>
      {group.children.map((child) => (
        <Link
          key={child.href}
          href={child.href}
          className={cn(
            "flex items-center rounded-md py-2 pl-9 pr-3 text-sm font-medium transition-colors",
            child.href === activeHref ? linkActive : linkIdle
          )}
          onClick={onNavigate}
        >
          {child.label}
        </Link>
      ))}
    </div>
  );
}
