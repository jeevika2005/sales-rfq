"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HelpCircle, Sun, Moon, Globe, Settings, Circle, type LucideIcon } from "lucide-react";
import { Users, ShieldCheck, ListTree, KeyRound } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

const ICON_MAP: Record<string, LucideIcon> = { Users, ShieldCheck, ListTree, KeyRound };

function resolveIcon(iconName: string | null) {
  return (iconName && ICON_MAP[iconName]) || Circle;
}

type MenuItem = {
  id: string;
  menuKey: string;
  name: string;
  url: string | null;
  icon: string | null;
  isParent: boolean;
  parentId: string | null;
};

function isHrefActive(pathname: string | null, href: string) {
  return pathname === href || (href !== "/" && !!pathname?.startsWith(href));
}

function SettingsMenu() {
  const pathname = usePathname();
  const [navItems, setNavItems] = useState<MenuItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/left-menu/my")
      .then((response) => response.json())
      .then((result) => {
        if (result.success) setNavItems(result.data);
      });
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Everything except Dashboard/RFQ List — those two live in the sidebar
  // instead. See Sidebar.tsx.
  const settingsItems = navItems.filter((item) => item.menuKey !== "dashboard" && item.menuKey !== "quotes");
  const standaloneItems = settingsItems.filter((item) => !item.isParent && !item.parentId);
  const parentGroups = settingsItems
    .filter((item) => item.isParent)
    .map((parent) => ({ parent, children: settingsItems.filter((item) => item.parentId === parent.id) }));

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="p-2 text-muted-foreground transition-colors hover:text-foreground"
        title="Settings"
      >
        <Settings className="h-4 w-4" />
      </button>

      {isOpen ? (
        <div className="absolute right-0 z-20 mt-2 w-56 rounded-md border border-border bg-card py-1 shadow-lg">
          {standaloneItems.map((item) => {
            const href = item.url ?? "#";
            const Icon = resolveIcon(item.icon);
            return (
              <Link
                key={item.id}
                href={href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors hover:bg-muted ${
                  isHrefActive(pathname, href) ? "text-primary" : "text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.name}
              </Link>
            );
          })}

          {parentGroups.map(({ parent, children }) =>
            children.length > 0 ? (
              <div key={parent.id} className="border-t border-border py-1 first:border-t-0">
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {parent.name}
                </p>
                {children.map((child) => {
                  const href = child.url ?? "#";
                  const ChildIcon = resolveIcon(child.icon);
                  return (
                    <Link
                      key={child.id}
                      href={href}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors hover:bg-muted ${
                        isHrefActive(pathname, href) ? "text-primary" : "text-foreground"
                      }`}
                    >
                      <ChildIcon className="h-3.5 w-3.5" />
                      {child.name}
                    </Link>
                  );
                })}
              </div>
            ) : null,
          )}

          {standaloneItems.length === 0 && parentGroups.length === 0 ? (
            <p className="px-3 py-2 text-[12px] text-muted-foreground">Nothing here yet.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [lang, setLang] = useState("EN");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- theme is only known client-side, avoids a hydration mismatch
    setMounted(true);
  }, []);

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 md:px-8 shrink-0">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {/* Language Toggle */}
        <button
          onClick={() => setLang(lang === "EN" ? "ES" : "EN")}
          className="flex items-center gap-1 p-2 text-muted-foreground hover:text-foreground transition-colors text-xs font-semibold"
          title="Toggle Language"
        >
          <Globe className="w-4 h-4" />
          {lang}
        </button>

        {/* Theme Toggle */}
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            title="Toggle Theme"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        )}

        {/* Help Panel Trigger */}
        <button className="p-2 text-muted-foreground hover:text-foreground transition-colors" title="Help">
          <HelpCircle className="w-4 h-4" />
        </button>

        <div className="h-5 w-px bg-border" />

        {/* Settings — Customers, Administration (Users/Roles/Permissions/Left Menu) */}
        <SettingsMenu />
      </div>
    </header>
  );
}
