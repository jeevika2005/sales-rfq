"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  FileText,
  Users,
  ShieldCheck,
  ListTree,
  KeyRound,
  UserCog,
  Circle,
  ChevronDown,
  LogOut,
  type LucideIcon,
} from "lucide-react";

import { useToast } from "@/components/providers/ToastProvider";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  FileText,
  Users,
  ShieldCheck,
  ListTree,
  KeyRound,
  UserCog,
};

type MenuItem = {
  id: string;
  menuKey: string;
  name: string;
  url: string | null;
  icon: string | null;
  isParent: boolean;
  parentId: string | null;
};

function resolveIcon(iconName: string | null) {
  return (iconName && ICON_MAP[iconName]) || Circle;
}

function isHrefActive(pathname: string | null, href: string) {
  return pathname === href || (href !== "/" && !!pathname?.startsWith(href));
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

type Account = { name: string; email: string; role: string };

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { showToast } = useToast();
  const [navItems, setNavItems] = useState<MenuItem[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);

  async function handleLogout() {
    setIsLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    showToast("success", "Logged out successfully");
    router.push("/login");
    router.refresh();
  }

  useEffect(() => {
    fetch("/api/left-menu/my")
      .then((response) => response.json())
      .then((result) => {
        if (result.success) setNavItems(result.data);
      });
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((result) => {
        if (result.success) setAccount(result.data);
      });
  }, []);

  // Sidebar only ever shows Dashboard + RFQ List — everything else
  // (Customers, Administration and its children) lives in the header's
  // Settings dropdown instead. See Header.tsx.
  const { standaloneItems, parentGroups } = useMemo(() => {
    const sidebarItems = navItems.filter((item) => item.menuKey === "dashboard" || item.menuKey === "quotes");
    const parents = sidebarItems.filter((item) => item.isParent);
    const standalone = sidebarItems.filter((item) => !item.isParent && !item.parentId);
    const groups = parents.map((parent) => ({
      parent,
      children: sidebarItems.filter((item) => item.parentId === parent.id),
    }));
    return { standaloneItems: standalone, parentGroups: groups };
  }, [navItems]);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const group of parentGroups) {
      next[group.parent.id] = group.children.some((child) => isHrefActive(pathname, child.url ?? "#"));
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- auto-expand the group containing the current page once menus load
    setExpandedGroups((prev) => ({ ...next, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentGroups.length]);

  return (
    <div className="w-64 bg-card border-r border-border h-full flex flex-col flex-shrink-0">
      <div className="h-16 flex items-center px-6 border-b border-border shrink-0">
        <h1 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary text-primary-foreground flex items-center justify-center font-bold">
            IO
          </div>
          Sales RFQ
        </h1>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {standaloneItems.map((item) => {
          const href = item.url ?? "#";
          const isActive = isHrefActive(pathname, href);
          const Icon = resolveIcon(item.icon);
          return (
            <Link
              key={item.id}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="font-medium">{item.name}</span>
            </Link>
          );
        })}

        {parentGroups.map(({ parent, children }) => {
          const ParentIcon = resolveIcon(parent.icon);
          const isExpanded = !!expandedGroups[parent.id];
          return (
            <div key={parent.id}>
              <button
                type="button"
                onClick={() => setExpandedGroups((prev) => ({ ...prev, [parent.id]: !prev[parent.id] }))}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ParentIcon className="h-4 w-4" />
                <span className="flex-1 text-left font-medium">{parent.name}</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
              </button>

              {isExpanded ? (
                <div className="mt-1 flex flex-col gap-1 border-l border-border pl-4">
                  {children.map((child) => {
                    const href = child.url ?? "#";
                    const isActive = isHrefActive(pathname, href);
                    const ChildIcon = resolveIcon(child.icon);
                    return (
                      <Link
                        key={child.id}
                        href={href}
                        className={`flex items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors ${
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <ChildIcon className="h-3.5 w-3.5" />
                        <span className="font-medium">{child.name}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        {account ? (
          <div className="flex items-center gap-2.5 rounded-md px-1 py-1.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
              {initialsFor(account.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-foreground">{account.name}</p>
              <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">{account.role}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              title="Logout"
              className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            <span className="font-medium">{isLoggingOut ? "Signing out…" : "Logout"}</span>
          </button>
        )}
        <p className="mt-2 px-1 text-[11px] text-muted-foreground">Sales RFQ &copy; 2026</p>
      </div>
    </div>
  );
}
