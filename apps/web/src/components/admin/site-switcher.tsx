"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Select } from "@/components/ui/select";
import type { SiteSummary } from "@/server/services/site-service";

type Props = {
  sites: SiteSummary[];
  activeSiteId: string;
};

export function SiteSwitcher({ sites, activeSiteId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleChange = (value: string) => {
    startTransition(() => {
      const next = new URLSearchParams(searchParams.toString());
      const site = sites.find((s) => s.id === value);
      if (site) {
        next.set("site", site.slug);
      } else {
        next.delete("site");
      }

      const query = next.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold uppercase text-slate-500">
        Site
      </span>
      <Select
        value={activeSiteId}
        disabled={isPending}
        onChange={(event) => handleChange(event.target.value)}
        className="w-56"
      >
        {sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

