"use client";

import type { NavigationPlacement } from "@prisma/client";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Select } from "@/components/ui/select";

type PlacementOption = {
  label: string;
  value: NavigationPlacement;
};

type Props = {
  options: PlacementOption[];
  value: NavigationPlacement;
};

export function NavigationPlacementSelect({ options, value }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = (nextValue: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextValue === "PRIMARY") {
      params.delete("placement");
    } else {
      params.set("placement", nextValue);
    }
    const query = params.toString();
    const href = (query ? `${pathname}?${query}` : pathname) as Route;
    router.push(href);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold uppercase text-slate-500">
        Menu placement
      </span>
      <Select
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        className="w-56"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}


