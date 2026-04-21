# Argus — Baseline Metrics

**Captured:** 2026-04-20
**Purpose:** Record current pipeline behavior before changes to role docs, prompts, or state machines. Every subsequent measurement should compare against this file. If numbers move, we know why. If they don't, we know that too.

---

## Data Source

All numbers below are queries against `hermes/hermes.db`, an append-only SQLite event log written by the orchestration engine. No synthetic data, no cherry-picking — these are the events from real usage of Argus on real tasks since the events table began recording.

The `build.agent.completed` topic was wired to persist on 2026-04-20, so its sample is small (7 runs). The other topics cover the full history of the DB.

---

## Event Volume (full history)

| Topic | Count |
|---|---|
| `agent.started` | 146 |
| `agent.failed` | 19 |
| `build.agent.completed` | 7 |
| `discuss.started` | 30 |
| `discuss.submitted` | 16 |
| `discuss.new` | 3 |
| `grade.received` | 50 |
| `task.submitted` | 40 |
| `task.done` | 23 |
| `task.aborted` | 12 |

**Task completion rate:** 23 done / 40 submitted = **57.5%**
**Task abort rate:** 12 / 40 = **30%**
**Agent process failure rate:** 19 failed / 146 started = **13%**

---

## Grade Distribution (50 audits)

| Grade | Count | % |
|---|---|---|
| A | 19 | 38% |
| B | 23 | 46% |
| C | 7 | 14% |
| F | 1 | 2% |

**First-pass A rate:** 38%
**Pass-or-revise (A+B) rate:** 84%
**Substantial-revision-needed (C+F) rate:** 16%

Interpretation: Codex flags most first-pass builds for revision. Whether this reflects the pipeline adding value or Codex being too strict is unresolved — needs comparison against a solo-agent baseline to answer.

---

## A-Rate Over Time

| Date | Audits | Grade A | A-Rate |
|---|---|---|---|
| 2026-04-13 | 18 | 5 | 28% |
| 2026-04-14 | 3 | 3 | 100% |
| 2026-04-15 | 4 | 1 | 25% |
| 2026-04-17 | 18 | 7 | 39% |
| 2026-04-18 | 2 | 1 | 50% |
| 2026-04-20 | 5 | 2 | 40% |

Daily sample sizes are too small for significance, but the overall trajectory is flat around 30-40% A-rate. No visible improvement from prompt/role-doc iteration yet. This is the number to watch as future changes land.

---

## Per-Agent Latency (16 runs since instrumentation, refreshed 2026-04-20 evening)

| Role | Runs | Avg | Max | Succeeded | Failed |
|---|---|---|---|---|---|
| plan (Claude) | 4 | 71.2s | 149.6s | 4 | 0 |
| build (Gemini) | 7 | 54.4s | 125.9s | 7 | 0 |
| audit (Codex) | 5 | 86.7s | 110.8s | 5 | 0 |

Sample size still small but doubled since the first snapshot. Observations that now have more weight:

- **Auditing is the slowest stage on average** (86.7s), not planning. The prior snapshot (2 plan runs at 108s avg) was pulled up by one long outlier. With 4 plan runs the planner averages 71s.
- **Building is fastest on average** (54.4s) but has the widest spread (max 125.9s) — one-shot builds complete fast; revision-loop rebuilds drag the tail.
- Complete happy-path iteration (1× plan + 1× build + 1× audit) averages ~212s ≈ **3.5 minutes**. Down from 4.4 min in the 7-row snapshot — again, one-run-pulls-the-mean effect.
- A 2-iteration task (B→A): ~336s total agent time observed live (task 42, see per-task queries below).
- Zero process failures across all 16 telemetry rows. The broader 13% `agent.failed` rate from the full DB predates this instrumentation and includes many pre-session-removal crashes that no longer apply.

---

## Known Gaps in This Baseline

- **No solo-agent comparison yet.** Argus's grade distribution means nothing without knowing what Claude, Gemini, or Codex alone would produce on the same tasks. Comparison is the next eval.
- ~~**No per-task event correlation.**~~ **Resolved 2026-04-20** — `task_id` column added to `events`; build-pipeline rows now attributed. See the per-task queries section below for the queries this unlocks.
- **No cost/token data.** CLI token usage isn't captured. Running in loops has no cost visibility. Fix planned.
- **Small `build.agent.completed` sample (16 rows as of 2026-04-20 evening, 7 of them pre-task-id).** Sample will grow with usage.
- **Warzone / chat events are unattributed.** Intentional — no unified task model across pipelines yet. File "unify task model" as future work when needed.
- **No definition of "task success" independent of Codex's grade.** A B-graded output may be production-ready for most users. Without external evaluation, A-rate under-measures real usefulness.

---

## How to Refresh These Numbers

Run each query from the `hermes/` directory (so `hermes.db` is the working path).

**Event volume by topic:**

```bash
sqlite3 hermes.db "SELECT topic, COUNT(*) FROM events GROUP BY topic ORDER BY topic;"
```

**Per-agent latency + success/failure counts** (requires `build.agent.completed` rows — instrumentation landed 2026-04-20):

```bash
sqlite3 hermes.db "
SELECT
  json_extract(payload, '\$.role') AS role,
  COUNT(*) AS runs,
  ROUND(AVG(CAST(json_extract(payload, '\$.durationMs') AS INTEGER)) / 1000.0, 1) AS avg_sec,
  ROUND(MAX(CAST(json_extract(payload, '\$.durationMs') AS INTEGER)) / 1000.0, 1) AS max_sec,
  SUM(CASE WHEN CAST(json_extract(payload, '\$.exitCode') AS INTEGER) = 0 THEN 1 ELSE 0 END) AS succeeded,
  SUM(CASE WHEN CAST(json_extract(payload, '\$.exitCode') AS INTEGER) != 0 THEN 1 ELSE 0 END) AS failed
FROM events
WHERE topic = 'build.agent.completed'
GROUP BY role;
"
```

**Grade distribution across all audits:**

```bash
sqlite3 hermes.db "
SELECT
  json_extract(payload, '\$.grade') AS grade,
  COUNT(*) AS count
FROM events
WHERE topic = 'grade.received'
GROUP BY grade
ORDER BY grade;
"
```

**A-rate over time (by day):**

```bash
sqlite3 hermes.db "
SELECT
  DATE(ts) AS day,
  COUNT(*) AS audits,
  SUM(CASE WHEN json_extract(payload, '\$.grade') = 'A' THEN 1 ELSE 0 END) AS grade_a
FROM events
WHERE topic = 'grade.received'
GROUP BY day
ORDER BY day;
"
```

**Task submission / completion summary:**

```bash
sqlite3 hermes.db "
SELECT
  (SELECT COUNT(*) FROM events WHERE topic = 'task.submitted') AS submitted,
  (SELECT COUNT(*) FROM events WHERE topic = 'task.done')      AS done,
  (SELECT COUNT(*) FROM events WHERE topic = 'task.aborted')   AS aborted,
  (SELECT COUNT(*) FROM events WHERE topic = 'agent.failed')   AS agent_failures;
"
```

## Per-task queries (unlocked by `task_id` migration, 2026-04-20)

The `events` table got a `task_id INTEGER` column on 2026-04-20. Rows inserted
before that migration have `task_id IS NULL`; rows from build-pipeline tasks
submitted after are attributed to their `tasks.id`. Warzone and chat rows are
intentionally unattributed (no unified task model yet — filed as future work).

### Iteration trajectory per task

Shows the sequence of grades received per task — useful for "how many revisions
did it take to reach A, and what was the path?"

```bash
sqlite3 hermes.db "
SELECT task_id,
       COUNT(*) AS audits,
       GROUP_CONCAT(json_extract(payload, '\$.grade'), '→') AS trajectory
FROM events
WHERE topic = 'grade.received' AND task_id IS NOT NULL
GROUP BY task_id;
"
```

**Example output (2026-04-20 test runs):**

```
42|2|B→A
```

Task 42 took two audits: first graded B, the revised build graded A.

### Total agent wall-time per task

Joins `tasks` to `events` on `task_id` and sums per-agent `durationMs` from
`build.agent.completed` payloads. Useful for "how expensive was this task
in wall-clock agent time."

```bash
sqlite3 hermes.db "
SELECT t.id, t.description, t.final_grade,
       SUM(CAST(json_extract(e.payload, '\$.durationMs') AS INTEGER)) / 1000.0 AS total_agent_seconds
FROM tasks t
JOIN events e ON e.task_id = t.id
WHERE e.topic = 'build.agent.completed'
GROUP BY t.id;
"
```

**Example output (2026-04-20 test runs):**

```
41|create a basic webpage displaying a python program for hello world and output|A|166.169
42|i need a webpage o display my faviorite anime|A|336.172
```

Task 41 (grade A on first pass) took ~166s of agent time; task 42 (B→A
revision loop) took ~336s — roughly 2x, which matches the extra iteration.

### Full event timeline for one task

Shows every event Hermes logged for a specific task, in insertion order.
Useful for debugging a specific build's behavior.

```bash
sqlite3 hermes.db "
SELECT id, ts, topic, json_extract(payload, '\$.role') AS role
FROM events
WHERE task_id = 42
ORDER BY id;
"
```

### Still not queryable

Cost/token data isn't captured. The CLIs expose token usage in their output
(Claude via cost headers, Codex in its footer, Gemini's stdout) but Hermes
doesn't parse or store it yet. Add `tokens_input`, `tokens_output`,
`cost_cents` columns to the `tasks` table when token instrumentation lands.