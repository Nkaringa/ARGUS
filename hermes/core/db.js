const Database = require('better-sqlite3');
const path = require('path');

// hermes.db lives at hermes/ root (one level up from core/)
const db = new Database(path.join(__dirname, '../hermes.db'));

db.exec(`
    CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT NOT NULL,
        topic TEXT NOT NULL,
        payload TEXT NOT NULL
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

const insertEvent = db.prepare(
    'INSERT INTO events (ts, topic, payload) VALUES (?, ?, ?)'
);

const insertTask = db.prepare(
    'INSERT INTO tasks (created_at, description, status) VALUES (?, ?, ?) RETURNING id'
);

const updateTask = db.prepare(
    'UPDATE tasks SET completed_at = ?, iterations = ?, final_grade = ?, status = ? WHERE id = ?'
);

function logEvent(topic, payload) {
    insertEvent.run(new Date().toISOString(), topic, JSON.stringify(payload));
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
