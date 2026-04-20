import { useEffect, useRef, useState } from 'react';
import { SERVERS, authHeaders } from '../config';
import type { BuildArchive, DiscussionArchive, HistoryEntry } from '../types';

async function loadLists() {
  const [b, d] = await Promise.all([
    fetch(`${SERVERS.build.http}/history/builds`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : { builds: [] }))
      .catch(() => ({ builds: [] })),
    fetch(`${SERVERS.warzone.http}/history/discussions`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : { discussions: [] }))
      .catch(() => ({ discussions: [] })),
  ]);
  return {
    builds: Array.isArray(b.builds) ? b.builds : [],
    discussions: Array.isArray(d.discussions) ? d.discussions : [],
  };
}

// Fetches the lists of archived builds and discussions on mount and exposes a
// refresh helper. The async work lives inside a Promise callback, so setState
// runs after an await (not synchronously in the effect body) — satisfies the
// react-hooks/set-state-in-effect rule without suppressing it.
export function useHistory() {
  const [builds, setBuilds] = useState<HistoryEntry[]>([]);
  const [discussions, setDiscussions] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const refreshTokenRef = useRef(0);

  useEffect(() => {
    const token = ++refreshTokenRef.current;
    loadLists().then((data) => {
      if (token !== refreshTokenRef.current) return;
      setBuilds(data.builds);
      setDiscussions(data.discussions);
      setLoading(false);
    });
  }, []);

  const refresh = () => {
    const token = ++refreshTokenRef.current;
    return loadLists().then((data) => {
      if (token !== refreshTokenRef.current) return;
      setBuilds(data.builds);
      setDiscussions(data.discussions);
    });
  };

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
