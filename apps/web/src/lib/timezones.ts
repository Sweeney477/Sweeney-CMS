const FALLBACK_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "Europe/Warsaw",
  "Europe/Moscow",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
];

type IntlWithSupport = typeof Intl & {
  supportedValuesOf?: (input: string) => string[];
};

const intlWithSupport = Intl as IntlWithSupport;

const detectedTimezones =
  typeof intlWithSupport.supportedValuesOf === "function"
    ? intlWithSupport.supportedValuesOf("timeZone")
    : FALLBACK_TIMEZONES;

export const TIMEZONES = Array.from(
  new Set([...detectedTimezones, ...FALLBACK_TIMEZONES]),
).sort((a, b) => a.localeCompare(b));

export function isValidTimeZone(value: string | undefined | null) {
  if (!value) {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

