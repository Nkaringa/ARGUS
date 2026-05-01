import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SERVERS, authHeaders } from '../config';
import type { HistoryItem } from '../types';

// Filter shape used by the /logs view. status/grade are sets so chips behave
// as toggles (click to add, click again to remove). Empty sets mean "no filter
// in this category" (i.e. match all values).
export interface LogsFilters {
  search: string;
  status: Set<string>;
  grade: Set<string>;
}

interface UseLogsHistoryReturn {
  items: HistoryItem[];
  total: number;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  filters: LogsFilters;
  setSearch: (q: string) => void;
  toggleStatus: (s: string) => void;
  toggleGrade: (g: string) => void;
  clearFilters: () => void;
  loadMore: () => void;
}

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 250;

// Build the query string for a given filter+offset combo. Encodes set members
// as comma-separated values; empty filters omit their param so the server
// applies no constraint.
function buildQuery(filters: LogsFilters, offset: number): string {
  const params = new URLSearchParams();
  params.set('limit', String(PAGE_SIZE));
  params.set('offset', String(offset));
  if (filters.search.trim()) params.set('search', filters.search.trim());
  if (filters.status.size > 0) params.set('status', Array.from(filters.status).join(','));
  if (filters.grade.size > 0) params.set('grade', Array.from(filters.grade).join(','));
  return params.toString();
}

// Owns the /logs page's data lifecycle: filter state, paginated item list,
// loading/error flags, and the load-more affordance. Reset-on-remount by
// design — there's no persistence across navigation. A filter change clears
// the cumulative list and refetches from offset 0; loadMore() appends the
// next page.
export function useLogsHistory(): UseLogsHistoryReturn {
  const [filters, setFilters] = useState<LogsFilters>({
    search: '',
    status: new Set(),
    grade: new Set(),
  });
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Debounced search value — actual fetch trigger. Decoupled from filters.search
  // so each keystroke updates the input synchronously but the network call
  // waits for the user to pause typing.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  // Tracks the latest fetch so out-of-order responses (slow earlier request
  // arriving after a fresh one) can be discarded.
  const fetchSeqRef = useRef(0);

  // Debounce the search input: every keystroke restarts a 250ms timer; the
  // last keystroke wins. When the user stops typing, debouncedSearch updates,
  // which triggers the fetch effect below.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(filters.search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [filters.search]);

  // Effective filter object the fetch effect actually depends on — uses the
  // debounced search instead of the live one. Memoized so the fetch effect's
  // dep-array compares cleanly across renders.
  const effective = useMemo<LogsFilters>(
    () => ({ search: debouncedSearch, status: filters.status, grade: filters.grade }),
    [debouncedSearch, filters.status, filters.grade]
  );

  const fetchPage = useCallback(
    async (f: LogsFilters, offset: number, append: boolean) => {
      const seq = ++fetchSeqRef.current;
      setLoading(true);
      setError(null);
      try {
        const url = `${SERVERS.build.http}/history?${buildQuery(f, offset)}`;
        const res = await fetch(url, { headers: authHeaders() });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(body.error || `Request failed (${res.status})`);
        }
        const json = await res.json();
        // Stale response guard: a newer fetch already started, drop this one.
        if (seq !== fetchSeqRef.current) return;
        setTotal(typeof json.total === 'number' ? json.total : 0);
        setItems((prev) =>
          append ? [...prev, ...(json.items as HistoryItem[])] : (json.items as HistoryItem[])
        );
      } catch (e) {
        if (seq !== fetchSeqRef.current) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (seq === fetchSeqRef.current) setLoading(false);
      }
    },
    []
  );

  // Filter changes → refetch from offset 0, replacing the list. Initial mount
  // also goes through this path (debouncedSearch starts as '', which the
  // effect uses as the initial query).
  useEffect(() => {
    fetchPage(effective, 0, false);
  }, [effective, fetchPage]);

  const setSearch = useCallback((q: string) => {
    setFilters((prev) => ({ ...prev, search: q }));
  }, []);

  const toggleStatus = useCallback((s: string) => {
    setFilters((prev) => {
      const next = new Set(prev.status);
      if (next.has(s)) next.delete(s); else next.add(s);
      return { ...prev, status: next };
    });
  }, []);

  const toggleGrade = useCallback((g: string) => {
    setFilters((prev) => {
      const next = new Set(prev.grade);
      if (next.has(g)) next.delete(g); else next.add(g);
      return { ...prev, grade: next };
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ search: '', status: new Set(), grade: new Set() });
  }, []);

  const loadMore = useCallback(() => {
    // Use the latest items.length as the offset so subsequent loads pick up
    // exactly where the cumulative list ended.
    fetchPage(effective, items.length, true);
  }, [effective, items.length, fetchPage]);

  return {
    items,
    total,
    loading,
    error,
    hasMore: items.length < total,
    filters,
    setSearch,
    toggleStatus,
    toggleGrade,
    clearFilters,
    loadMore,
  };
}
