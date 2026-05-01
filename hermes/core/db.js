const Database = require('better-sqlite3');
const path = require('path');

// hermes.db lives at hermes/ root (one level up from core/) by default.
// HERMES_DB_PATH overrides for tests (per-test temp DB) and deployments that want
// state on a mounted volume.
const DB_PATH = process.env.HERMES_DB_PATH || path.join(__dirname, '../hermes.db');
const db = new Database(DB_PATH);

// WAL (Write-Ahead Log) mode — readers don't block writers and vice versa.
// Matters because hermes runs three server processes (chat/build/warzone) each
// opening this same DB file; without WAL they'd serialize on every write.
// synchronous = NORMAL is safe with WAL (crash-durable up to the last fsync which
// happens at checkpoint time) and ~2x faster writes than synchronous = FULL.
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// Phase 1 — create tables if absent. Defines task_id inline for fresh installs.
// On pre-existing DBs, this is a no-op; Phase 2 migrates the existing schema.
db.exec(`
    CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT NOT NULL,
        topic TEXT NOT NULL,
        payload TEXT NOT NULL,
        task_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        completed_at TEXT,
        description TEXT NOT NULL,
        iterations INTEGER DEFAULT 0,
        final_grade TEXT,
        status TEXT
    );
`);

// Phase 2 — migrate pre-existing databases. Rows inserted before task_id existed
// retain task_id = NULL; new rows populate via the updated logEvent signature.
// SQLite errors if we ADD COLUMN for a column that already exists, so probe first.
const existingCols = db.prepare("PRAGMA table_info(events)").all();
if (!existingCols.some((c) => c.name === 'task_id')) {
    db.exec("ALTER TABLE events ADD COLUMN task_id INTEGER");
    console.log('[db] Migrated events table: added task_id column');
}

// Phase 3 — now that task_id is guaranteed to exist (fresh or migrated), create
// indexes. Done in a separate exec so failures above surface clearly.
// - task_id: for per-task queries (iterations-to-A, wall-time per task)
// - ts: for date-range queries (A-rate over time, retention policy pruning)
// - topic: for per-topic filtering (the default filter on most queries)
// Combined topic+ts is left as a future optimization when query plans show need.
db.exec("CREATE INDEX IF NOT EXISTS idx_events_task_id ON events(task_id)");
db.exec("CREATE INDEX IF NOT EXISTS idx_events_ts       ON events(ts)");
db.exec("CREATE INDEX IF NOT EXISTS idx_events_topic    ON events(topic)");

const insertEvent = db.prepare(
    'INSERT INTO events (ts, topic, payload, task_id) VALUES (?, ?, ?, ?)'
);

const insertTask = db.prepare(
    'INSERT INTO tasks (created_at, description, status) VALUES (?, ?, ?) RETURNING id'
);

const updateTask = db.prepare(
    'UPDATE tasks SET completed_at = ?, iterations = ?, final_grade = ?, status = ? WHERE id = ?'
);

// task_id is optional and defaults to null. Callers in the build workflow should pass
// the active task's id so rows can be joined against the tasks table; warzone and chat
// pass null today (no unified task model yet — filed as future work).
function logEvent(topic, payload, taskId = null) {
    insertEvent.run(new Date().toISOString(), topic, JSON.stringify(payload), taskId);
}

function createTask(description) {
    const row = insertTask.get(new Date().toISOString(), description, 'RUNNING');
    return row.id;
}

function completeTask(id, iterations, grade, status) {
    updateTask.run(new Date().toISOString(), iterations, grade, status, id);
}

// Build the WHERE clause + parameter list for filtered history queries.
// Used by both getHistory (rows) and getHistoryCount (total). Returns
// `{ sql, params }` where sql includes the leading "WHERE ..." or empty string.
// Filters compose as AND across categories, OR within a category (multi-value
// fields like status/grade are passed as arrays and expand to IN (?, ?, ...)).
function buildHistoryWhere({ search, status, grade } = {}) {
    const clauses = [];
    const params = [];
    if (search && typeof search === 'string' && search.trim()) {
        clauses.push('description LIKE ?');
        params.push('%' + search.trim() + '%');
    }
    if (Array.isArray(status) && status.length > 0) {
        clauses.push(`UPPER(status) IN (${status.map(() => '?').join(', ')})`);
        params.push(...status.map((s) => String(s).toUpperCase()));
    }
    if (Array.isArray(grade) && grade.length > 0) {
        // grade is stored as 'A' | 'B' | 'C' | 'F' | NULL. Caller can pass
        // 'NONE' to match NULL (the "no grade yet" filter).
        const concrete = grade.filter((g) => g && String(g).toUpperCase() !== 'NONE');
        const wantsNone = grade.some((g) => String(g).toUpperCase() === 'NONE');
        const sub = [];
        if (concrete.length > 0) {
            sub.push(`UPPER(final_grade) IN (${concrete.map(() => '?').join(', ')})`);
            params.push(...concrete.map((g) => String(g).toUpperCase()));
        }
        if (wantsNone) sub.push('final_grade IS NULL');
        if (sub.length > 0) clauses.push('(' + sub.join(' OR ') + ')');
    }
    return clauses.length === 0 ? { sql: '', params } : { sql: 'WHERE ' + clauses.join(' AND '), params };
}

// Read tasks for the /logs page. Optional `opts` for filter + pagination —
// callers without opts (the build server's WS-snapshot) get the prior default
// behavior (latest 20). Returns rows including completed_at so the UI can show
// wall-time per row.
function getHistory(opts = {}) {
    if (typeof opts === 'number') opts = { limit: opts }; // back-compat for getHistory(20)
    const limit  = Math.max(1, Math.min(100, Number.isFinite(opts.limit)  ? opts.limit  : 20));
    const offset = Math.max(0,           Number.isFinite(opts.offset) ? opts.offset : 0);
    const where = buildHistoryWhere(opts);
    return db.prepare(
        `SELECT id, description, status, iterations, created_at, completed_at, final_grade AS grade
         FROM tasks
         ${where.sql}
         ORDER BY id DESC
         LIMIT ? OFFSET ?`
    ).all(...where.params, limit, offset);
}

// Total row count for the same filter set — drives the UI's "load more"
// affordance (button hides when items.length >= total).
function getHistoryCount(opts = {}) {
    const where = buildHistoryWhere(opts);
    const row = db.prepare(`SELECT COUNT(*) AS n FROM tasks ${where.sql}`).get(...where.params);
    return row ? row.n : 0;
}

// Aggregate the rich detail for a single task by reading its events table
// rows. Powers the click-to-expand row on /logs. Output shape:
//   {
//     slug, mode, autoApprove, autoApproveCap, planReview,
//     iterations: [{ iteration, role, durationMs, exitCode, grade?, postSize?, bytesAppended? }],
//     gradeTrail: [{ iteration, grade }],     // chronological per grade.received
//     agentTotals: { claude: ms, gemini: ms, codex: ms },
//     files: [{ name, sizeBytes, role }],
//     failures: [{ iteration?, role, error }],
//     truncated: boolean                       // true if event scan hit the 1000 cap
//   }
const DETAIL_EVENT_CAP = 1000;
function getTaskDetail(taskId) {
    if (!Number.isFinite(taskId)) return null;
    const events = db.prepare(
        `SELECT topic, payload FROM events
         WHERE task_id = ?
         ORDER BY id ASC
         LIMIT ?`
    ).all(taskId, DETAIL_EVENT_CAP + 1);
    const truncated = events.length > DETAIL_EVENT_CAP;
    const scan = events.slice(0, DETAIL_EVENT_CAP);

    let slug = null, mode = null, autoApprove = false, autoApproveCap = null, planReview = false;
    const gradeTrail = [];
    const agentTotals = { claude: 0, gemini: 0, codex: 0 };
    const filesByRole = new Map(); // role → { name, sizeBytes }
    const failures = [];

    // Two event topics both carry "agent completion" semantics:
    //   - agent.completed                    → workflow-emitted phase completion
    //                                          (role, iteration, title, bytes_appended, post_size)
    //   - <pipeline>.agent.completed         → agent-runner-emitted process exit
    //                                          (agent, role, durationMs, exitCode)
    // We need both: post_size for the FILES section, durationMs for the AGENT
    // BREAKDOWN. The branch below distinguishes by which fields the payload
    // carries, so a single switch case handles both topic shapes uniformly.
    const isAgentCompleted = (topic) =>
        topic === 'agent.completed' ||
        topic === 'build.agent.completed' ||
        topic === 'warzone.agent.completed' ||
        topic === 'chat.agent.completed';
    const isAgentFailed = (topic) =>
        topic === 'agent.failed' ||
        topic === 'build.agent.failed' ||
        topic === 'warzone.agent.failed' ||
        topic === 'chat.agent.failed';

    for (const ev of scan) {
        let p;
        try { p = JSON.parse(ev.payload); } catch { continue; }
        if (ev.topic === 'task.submitted') {
            if (p.slug !== undefined) slug = p.slug;
            if (p.mode !== undefined) mode = p.mode;
            if (p.auto_approve !== undefined) autoApprove = !!p.auto_approve;
            if (p.auto_approve_cap !== undefined) autoApproveCap = p.auto_approve_cap;
            if (p.plan_review !== undefined) planReview = !!p.plan_review;
        } else if (isAgentCompleted(ev.topic)) {
            // Sum process-exit durations into per-agent totals. The agent
            // field carries the CLI tool's display name ("Claude" / "Gemini"
            // / "Codex"), capitalized; lowercase to match our totals keys.
            if (Number.isFinite(p.durationMs)) {
                const agent = String(p.agent || '').toLowerCase();
                if (agent === 'claude' || agent === 'gemini' || agent === 'codex') {
                    agentTotals[agent] += p.durationMs;
                }
            }
            // Track file sizes from workflow phase-complete events. Maps the
            // agent's role to its canonical meta file; latest write wins.
            if (p.post_size !== undefined && p.role) {
                const r = String(p.role).toLowerCase();
                const fileName =
                    r === 'plan'  ? `${slug || 'task'}-Plan.md` :
                    r === 'build' ? `${slug || 'task'}-Build-Log.md` :
                    r === 'audit' ? `${slug || 'task'}-Build-Feedback.md` : null;
                if (fileName) filesByRole.set(r, { name: fileName, sizeBytes: p.post_size, role: r });
            }
        } else if (ev.topic === 'grade.received') {
            if (Number.isFinite(p.iteration) && typeof p.grade === 'string') {
                gradeTrail.push({ iteration: p.iteration, grade: p.grade.toUpperCase() });
            }
        } else if (isAgentFailed(ev.topic)) {
            failures.push({
                role: p.role || null,
                error: p.error || p.reason || null,
            });
        }
    }

    return {
        slug,
        mode,
        autoApprove,
        autoApproveCap,
        planReview,
        gradeTrail,
        agentTotals,
        files: Array.from(filesByRole.values()),
        failures,
        truncated,
    };
}

// Mark any task still in RUNNING state as STALE. Run on hermes boot — RUNNING
// rows that survived a process restart are zombies (the process that owned them
// is gone), and they pollute getHistory() by appearing as if a task is still in
// flight. STALE distinguishes them from CANCELLED (user-aborted) and DONE.
// Idempotent: subsequent calls find no RUNNING rows after the first sweep.
function sweepStaleRunningTasks() {
    const result = db.prepare("UPDATE tasks SET status = 'STALE' WHERE status = 'RUNNING'").run();
    if (result.changes > 0) {
        console.log(`[db] Marked ${result.changes} stale RUNNING task(s) as STALE on boot`);
    }
    return result.changes;
}

module.exports = { logEvent, createTask, completeTask, getHistory, getHistoryCount, getTaskDetail, sweepStaleRunningTasks };
