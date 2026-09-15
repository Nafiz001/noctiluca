export type Light = {
  id: string;
  message: string;
  wavelength: number;
  depth: number;
  drift: number;
  phase: number;
  energy: number;
  answers: number;
  created_at: string;
  dark_at: string;
  yours: boolean;
  answered: boolean;
};

export type LightSummary = Pick<Light, "id" | "energy" | "answers" | "dark_at">;

export type Creature = {
  slug: string;
  name: string;
  latin_name: string;
  depth_min: number;
  depth_max: number;
  home: number;
  wavelength: number | null;
  note: string;
};

export type SeaStats = {
  glowing: number;
  released: number;
  answers: number;
  deepest: number | null;
  divers: number;
};

export class SeaError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const DIVER_KEY = "noctiluca.diver";

// Divers have no accounts: the browser keeps a random token and the server
// only ever stores a keyed hash of it.
export function diverToken(): string {
  try {
    const existing = localStorage.getItem(DIVER_KEY);
    if (existing && /^[A-Za-z0-9_-]{16,64}$/.test(existing)) return existing;
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    localStorage.setItem(DIVER_KEY, token);
    return token;
  } catch {
    return sessionToken;
  }
}

const sessionToken = "session-" + Math.random().toString(36).slice(2, 14) + Math.random().toString(36).slice(2, 10);

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", "X-Diver": diverToken(), ...init.headers },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new SeaError(describeError(response.status, body), response.status);
  }
  return body as T;
}

function describeError(status: number, body: unknown): string {
  if (status === 429) return "You've left a lot of light recently. Wait a while, then try again.";
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.detail === "string") return record.detail;
    for (const value of Object.values(record)) {
      if (Array.isArray(value) && typeof value[0] === "string") return value[0];
      if (typeof value === "string") return value;
    }
  }
  if (status >= 500 || status === 0) return "The sea isn't answering. Check that the backend is running.";
  return "Something went wrong. Try again.";
}

export const api = {
  lights: () => request<Light[]>("lights"),
  creatures: () => request<Creature[]>("creatures"),
  sea: () => request<SeaStats>("sea"),
  release: (body: { message: string; wavelength: number; depth: number }) =>
    request<Light>("lights", { method: "POST", body: JSON.stringify(body) }),
  answer: (id: string) => request<Light>(`lights/${encodeURIComponent(id)}/answer`, { method: "POST" }),
};
