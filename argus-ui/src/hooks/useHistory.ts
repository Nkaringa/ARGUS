import { useCallback, useEffect, useState } from 'react';
import { SERVERS, authHeaders } from '../config';
import type { BuildArchive, DiscussionArchive, HistoryEntry } from '../types';

// Fetches the lists of archived builds and discussions on mount and exposes a
// refresh helper. Lists are independent — a failure on one shouldn't block the other.
// Read-only viewer; no mutation endpoints.
export function useHistory() {
  const [builds, setBuilds] = useState<HistoryEntry[]>([]);
  const [discussions, setDiscussions] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [b, d] = await Promise.all([
      fetch(`${SERVERS.build.http}/history/builds`, { headers: authHeaders() })
        .then((r) => (r.ok ? r.json() : { builds: [] }))
        .catch(() => ({ builds: [] })),
      fetch(`${SERVERS.warzone.http}/history/discussions`, { headers: authHeaders() })
        .then((r) => (r.ok ? r.json() : { discussions: [] }))
        .catch(() => ({ discussions: [] })),
    ]);
    setBuilds(Array.isArray(b.builds) ? b.builds : []);
    setDiscussions(Array.isArray(d.discussions) ? d.discussions : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { builds, discussions, loading, refresh };
}

export async function fetchBuildArchive(slug: string): Promise<BuildArchive | null> {
  const res = await fetch(`${SERVERS.build.http}/history/builds/${encodeURIComponent(slug)}`, {
    headers: authHeaders(),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchDiscussionArchive(slug: string): Promise<DiscussionArchive | null> {
  const res = await fetch(`${SERVERS.warzone.http}/history/discussions/${encodeURIComponent(slug)}`, {
    headers: authHeaders(),
  });
  if (!res.ok) return null;
  return res.json();
}
