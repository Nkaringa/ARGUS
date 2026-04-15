const host = import.meta.env.VITE_HOST || 'localhost';
const chatPort = import.meta.env.VITE_CHAT_PORT || '3001';
const buildPort = import.meta.env.VITE_BUILD_PORT || '3002';
const warzonePort = import.meta.env.VITE_WARZONE_PORT || '3003';

const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
const httpProto = isSecure ? 'https' : 'http';
const wsProto = isSecure ? 'wss' : 'ws';

export const SERVERS = {
  chat: {
    http: `${httpProto}://${host}:${chatPort}`,
    ws: `${wsProto}://${host}:${chatPort}`,
  },
  build: {
    http: `${httpProto}://${host}:${buildPort}`,
    ws: `${wsProto}://${host}:${buildPort}`,
  },
  warzone: {
    http: `${httpProto}://${host}:${warzonePort}`,
    ws: `${wsProto}://${host}:${warzonePort}`,
  },
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
