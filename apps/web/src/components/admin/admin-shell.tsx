import Link from "next/link";

import { SiteSwitcher } from "@/components/admin/site-switcher";
import { Badge } from "@/components/ui/badge";
import type { Site } from "@prisma/client";
import type { SiteSummary } from "@/server/services/site-service";
import { cn } from "@/lib/utils";

type AdminShellProps = {
  children: React.ReactNode;
  currentPath: string;
  sites: SiteSummary[];
  activeSite: Site;
};

const navLinks = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/pages", label: "Pages" },
  { href: "/admin/navigation", label: "Navigation" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminShell({
  children,
  currentPath,
  sites,
  activeSite,
}: AdminShellProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <span className="text-base font-semibold uppercase tracking-wide text-slate-500">
              Sweeney CMS
            </span>
            <Badge variant="outline">Admin</Badge>
          </div>
          <SiteSwitcher sites={sites} activeSiteId={activeSite.id} />
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-6xl gap-6 px-6 py-8">
        <aside className="w-48 shrink-0">
          <nav className="flex flex-col gap-2 text-sm font-medium text-slate-600">
            {navLinks.map((link) => {
              const isActive =
                currentPath === link.href || currentPath.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-lg px-3 py-2 transition hover:bg-slate-100",
                    isActive && "bg-slate-900 text-white hover:bg-slate-900",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="flex-1 space-y-6">{children}</main>
      </div>
    </div>
  );
}


