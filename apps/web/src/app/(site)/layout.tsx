import type { ReactNode } from "react";

type SiteLayoutProps = {
  children: ReactNode;
};

export default function SiteLayout({ children }: SiteLayoutProps) {
  return <div className="min-h-screen bg-white text-slate-900">{children}</div>;
}

