import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type ClassValue = Parameters<typeof clsx>[0];

export function buildAssetUrl(options: {
  cdnUrl?: string | null;
  url?: string | null;
}) {
  if (options.cdnUrl) {
    return options.cdnUrl;
  }
  const path = options.url ?? "";
  if (!path) {
    return "";
  }
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const base =
    typeof window === "undefined"
      ? process.env.ASSET_BASE_URL ?? process.env.NEXT_PUBLIC_ASSET_BASE_URL
      : process.env.NEXT_PUBLIC_ASSET_BASE_URL;

  if (!base) {
    return path;
  }

  return `${stripTrailingSlash(base)}/${path.replace(/^\//, "")}`;
}

function stripTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
