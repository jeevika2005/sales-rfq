"use client";

import Link from "next/link";
import { HelpCircle, Plus, Sun, Moon, Globe } from "lucide-react";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";

export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [lang, setLang] = useState("EN");

  useEffect(() => {
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
        <button 
          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          title="Help"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Primary Action Button */}
        <Link
          href="/quotes/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors ml-2"
        >
          <Plus className="w-4 h-4" />
          Add Quote
        </Link>
      </div>
    </header>
  );
}
