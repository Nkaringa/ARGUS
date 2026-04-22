const host        = import.meta.env.VITE_HOST        || 'localhost';
const chatPort    = import.meta.env.VITE_CHAT_PORT    || '3001';
const buildPort   = import.meta.env.VITE_BUILD_PORT   || '3002';
const warzonePort = import.meta.env.VITE_WARZONE_PORT || '3003';

// Production: set VITE_CHAT_HOST / VITE_BUILD_HOST / VITE_WARZONE_HOST to full
// Cloudflare tunnel subdomains. Cloudflare is always :443 — no port suffix needed.
// Local dev: leave unset — falls back to host:port (e.g. localhost:3001).
const chatHost    = import.meta.env.VITE_CHAT_HOST    || `${host}:${chatPort}`;
const buildHost   = import.meta.env.VITE_BUILD_HOST   || `${host}:${buildPort}`;
const warzoneHost = import.meta.env.VITE_WARZONE_HOST || `${host}:${warzonePort}`;

const isSecure  = typeof window !== 'undefined' && window.location.protocol === 'https:';
const httpProto = isSecure ? 'https' : 'http';
const wsProto   = isSecure ? 'wss'   : 'ws';

export const SERVERS = {
  chat:    { http: `${httpProto}://${chatHost}`,    ws: `${wsProto}://${chatHost}`    },
  build:   { http: `${httpProto}://${buildHost}`,   ws: `${wsProto}://${buildHost}`   },
  warzone: { http: `${httpProto}://${warzoneHost}`, ws: `${wsProto}://${warzoneHost}` },
};

// Auth helpers — used by all hooks.
// If VITE_API_KEY is not set, no auth headers are sent (local dev default).
const API_KEY = import.meta.env.VITE_API_KEY || '';

export function authHeaders(): Record<string, string> {
  return API_KEY ? { 'X-Api-Key': API_KEY } : {};
}

export function wsUrl(url: string): string {
  return API_KEY ? `${url}?key=${encodeURIComponent(API_KEY)}` : url;
}
