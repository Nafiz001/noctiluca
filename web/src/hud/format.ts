const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function ago(iso: string): string {
  const seconds = (Date.parse(iso) - Date.now()) / 1000;
  const abs = Math.abs(seconds);
  if (abs < 60) return "just now";
  if (abs < 3600) return relative.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), "hour");
  return relative.format(Math.round(seconds / 86400), "day");
}

export function fadesIn(iso: string): string {
  const hours = (Date.parse(iso) - Date.now()) / 3_600_000;
  if (hours <= 0) return "Fading now";
  if (hours < 1) return "Fades within the hour";
  if (hours < 36) return `Fades in about ${Math.round(hours)} hours`;
  return `Fades in about ${Math.round(hours / 24)} days`;
}

export const count = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
