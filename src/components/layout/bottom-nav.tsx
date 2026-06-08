"use client";

import { Brain, Library, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/library", label: "Biblioteca", icon: Library },
  { href: "/review", label: "Repaso", icon: Brain },
  { href: "/account", label: "Cuenta", icon: UserRound },
] as const;

/**
 * Mobile bottom navigation. Visible only below `sm` — desktop users get
 * the usual top-of-page nav elements. Hidden on routes that own the full
 * screen (the quiz player and demo /q/<slug>) because the floating
 * question grid + swipe gestures need the bottom real-estate.
 *
 * Active state matches when the current pathname starts with the item's
 * href, so /quiz/[id]/results keeps "Biblioteca" highlighted as the
 * conceptual parent.
 */
export function BottomNav() {
  const pathname = usePathname();

  const hidden =
    pathname.startsWith("/quiz/") ||
    pathname.startsWith("/q/") ||
    pathname === "/login" ||
    pathname === "/offline";
  if (hidden) return null;

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden"
    >
      <ul className="flex">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/library"
              ? pathname === "/library" || pathname.startsWith("/library/")
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 text-xs transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
