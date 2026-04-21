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

function getHistory(limit = 20) {
    return db.prepare(
        'SELECT id, description, status, iterations, created_at, final_grade AS grade FROM tasks ORDER BY id DESC LIMIT ?'
    ).all(limit);
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

module.exports = { logEvent, createTask, completeTask, getHistory, sweepStaleRunningTasks };
