const fs = require('fs');
const crypto = require('crypto');

// Meta-file primitives. Hermes owns canonical Build-Log.md and Build-Feedback.md exclusively;
// agents write per-iteration scratch files (`<slug>-iter.md`, `<slug>-audit.md`) which Hermes
// reads, validates, normalizes, and appends. Canonical files are kept chmod 0o444 between
// Hermes-controlled append windows so an agent's misbehaving Write tool call fails with EACCES
// instead of silently truncating history.
//
// Every operation here is "loud-failure-or-throw": no silent best-effort. Callers handle the
// thrown errors by halting the pipeline with a named event so the failure surfaces in the UI
// rather than corrupting downstream state.

class MetaFileError extends Error {
    constructor(reason, details = {}) {
        super(`${reason}: ${JSON.stringify(details)}`);
        this.reason = reason;
        this.details = details;
    }
}

const LOCKED_MODE = 0o444;
const UNLOCKED_MODE = 0o644;
const LOW_NINE_BITS = 0o777;

function hashFile(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const buf = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buf).digest('hex');
}

function hashPrefix(filePath, byteLength) {
    if (byteLength === 0) return crypto.createHash('sha256').update('').digest('hex');
    const fd = fs.openSync(filePath, 'r');
    try {
        const buf = Buffer.alloc(byteLength);
        const bytesRead = fs.readSync(fd, buf, 0, byteLength, 0);
        if (bytesRead !== byteLength) {
            throw new MetaFileError('prefix-read-short', {
                file: filePath, expected: byteLength, actual: bytesRead,
            });
        }
        return crypto.createHash('sha256').update(buf).digest('hex');
    } finally {
        fs.closeSync(fd);
    }
}

// Set canonical file to read-only and verify the chmod stuck. Throws if the verification
// shows a different mode than expected — silent chmod failure (umask, ACLs, ownership) is
// a real possibility on some filesystems and would defeat the whole protection scheme.
function lockCanonical(canonicalPath) {
    if (!fs.existsSync(canonicalPath)) return;
    fs.chmodSync(canonicalPath, LOCKED_MODE);
    const observed = fs.statSync(canonicalPath).mode & LOW_NINE_BITS;
    if (observed !== LOCKED_MODE) {
        throw new MetaFileError('chmod-lock-verify-failed', {
            file: canonicalPath,
            expected_mode: LOCKED_MODE.toString(8),
            actual_mode: observed.toString(8),
        });
    }
}

function unlockCanonical(canonicalPath) {
    if (!fs.existsSync(canonicalPath)) return;
    fs.chmodSync(canonicalPath, UNLOCKED_MODE);
    const observed = fs.statSync(canonicalPath).mode & LOW_NINE_BITS;
    if (observed !== UNLOCKED_MODE) {
        throw new MetaFileError('chmod-unlock-verify-failed', {
            file: canonicalPath,
            expected_mode: UNLOCKED_MODE.toString(8),
            actual_mode: observed.toString(8),
        });
    }
}

// Read a scratch file written by the agent. Missing or empty scratch is a hard failure —
// the agent exited cleanly but produced no work, which the workflow must treat as a build/audit
// failure rather than silently advancing the state machine.
function readScratch(scratchPath) {
    if (!fs.existsSync(scratchPath)) {
        throw new MetaFileError('scratch-missing', { file: scratchPath });
    }
    const content = fs.readFileSync(scratchPath, 'utf8');
    if (!content.trim()) {
        throw new MetaFileError('scratch-empty', { file: scratchPath });
    }
    return content;
}

// Parse a scratch file into { title, body, grade? }. Strips agent-supplied iteration headings
// and timestamps — those are Hermes's responsibility, agents must not provide them. Tolerant
// of agents that include them anyway (legacy habit) by silently dropping those lines.
function parseScratch(content, role) {
    const lines = content.split('\n');

    let titleIdx = -1;
    for (let i = 0; i < lines.length; i++) {
        if (/^#{1,4}\s+\S/.test(lines[i].trim())) {
            titleIdx = i;
            break;
        }
    }
    if (titleIdx === -1) {
        throw new MetaFileError('scratch-no-heading', { first_chars: content.slice(0, 200) });
    }

    let title = lines[titleIdx].trim().replace(/^#+\s*/, '');
    // Tolerate agents that wrote `### Iteration 5 — Title` despite the role doc — drop the
    // "Iteration N —" prefix; Hermes injects the canonical number on its own.
    title = title.replace(/^Iteration\s+\d+\s*[—–-]\s*/i, '').trim();
    if (!title) {
        throw new MetaFileError('scratch-empty-title', { heading_line: lines[titleIdx] });
    }

    const bodyLines = lines.slice(titleIdx + 1).filter((line) => {
        const trimmed = line.trim();
        if (trimmed === '---') return false;
        // Drop agent-supplied iteration/timestamp lines — Hermes owns these.
        if (/^-?\s*\*\*Iteration:?\*\*/i.test(trimmed)) return false;
        if (/^-?\s*\*\*Timestamp:?\*\*/i.test(trimmed)) return false;
        return true;
    });
    const body = bodyLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!body) {
        throw new MetaFileError('scratch-no-body', { title });
    }

    let grade = null;
    if (role === 'audit') {
        const match = content.match(/\*\*Audit Grade:\*\*\s*\[?([ABCF])\]?/);
        if (!match) {
            throw new MetaFileError('audit-scratch-no-grade', { title, body_first_chars: body.slice(0, 200) });
        }
        grade = match[1];
    }

    return { title, body, grade };
}

function slugToTitle(slug) {
    return slug
        .split('-')
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
        .join(' ');
}

function isoMinuteTimestamp() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

// Read a scratch file, validate its structure, assemble a canonical iteration entry with
// Hermes-owned iteration number + timestamp, append to the canonical file under a brief
// chmod 0o644 unlock window, re-lock, verify pre-prefix didn't change, and delete the scratch.
//
// Throws MetaFileError on any failure — the caller is expected to halt the pipeline with a
// named event (BUILD_FAILED / AUDIT_FAILED with `reason: err.reason, details: err.details`).
//
// Returns: { iteration, grade, bytesAppended, postSize, postHash } — caller logs/broadcasts.
function assembleAndAppend({ canonicalPath, scratchPath, slug, iterationNumber, role, kind }) {
    if (role !== 'build' && role !== 'audit') {
        throw new MetaFileError('assemble-bad-role', { role });
    }
    if (!Number.isInteger(iterationNumber) || iterationNumber < 1) {
        throw new MetaFileError('assemble-bad-iteration', { iterationNumber });
    }

    const scratchContent = readScratch(scratchPath);
    const parsed = parseScratch(scratchContent, role);

    // Snapshot canonical state before mutation. preSize=0 + preHash=null = file doesn't exist yet.
    const preExists = fs.existsSync(canonicalPath);
    const preSize = preExists ? fs.statSync(canonicalPath).size : 0;
    const preHash = preExists ? hashFile(canonicalPath) : null;

    // Compose the entry. Hermes owns the heading line and the timestamp — these are NOT trusted
    // from the agent. The body is the agent's content with iteration/timestamp lines stripped
    // by parseScratch.
    const heading = `### Iteration ${iterationNumber} — ${parsed.title}`;
    const timestamp = `- **Timestamp:** ${isoMinuteTimestamp()}`;
    const separator = preSize === 0 ? '' : '\n\n---\n\n';
    const fileHeader = preSize === 0 ? `# ${slugToTitle(slug)} ${kind}\n\n` : '';
    const entry = `${fileHeader}${separator}${heading}\n${timestamp}\n${parsed.body}\n`;

    // Unlock → append → re-lock. If any step throws, lockCanonical in the catch path makes a
    // best-effort to leave the file locked even on partial failure.
    try {
        if (preExists) unlockCanonical(canonicalPath);
        fs.appendFileSync(canonicalPath, entry);
        lockCanonical(canonicalPath);
    } catch (err) {
        try { lockCanonical(canonicalPath); } catch { /* swallow — primary error wins */ }
        if (err instanceof MetaFileError) throw err;
        throw new MetaFileError('append-failed', { file: canonicalPath, message: err.message });
    }

    // Post-write verification: prefix bytes must equal preHash; total size must have grown by
    // exactly the bytes we appended. If either check fails, a concurrent writer (despite the
    // lock) corrupted the file — halt loudly.
    const postSize = fs.statSync(canonicalPath).size;
    const expectedSize = preSize + Buffer.byteLength(entry);
    if (postSize !== expectedSize) {
        throw new MetaFileError('append-size-mismatch', {
            file: canonicalPath,
            pre_size: preSize,
            post_size: postSize,
            expected_size: expectedSize,
        });
    }
    if (preHash) {
        const prefixAfter = hashPrefix(canonicalPath, preSize);
        if (prefixAfter !== preHash) {
            throw new MetaFileError('canonical-prefix-corrupted', {
                file: canonicalPath,
                pre_size: preSize,
                pre_hash: preHash,
                actual_prefix_hash: prefixAfter,
            });
        }
    }
    const postHash = hashFile(canonicalPath);

    // Scratch cleanup. Failures are logged but not thrown — the iteration was successfully
    // appended; an orphan scratch will be swept by archival on task completion or next submit.
    try {
        fs.unlinkSync(scratchPath);
    } catch (err) {
        console.warn(`[meta-files] Failed to delete scratch ${scratchPath}: ${err.message}`);
    }

    return {
        iteration: iterationNumber,
        title: parsed.title,
        grade: parsed.grade,
        bytesAppended: Buffer.byteLength(entry),
        preSize,
        postSize,
        preHash,
        postHash,
    };
}

module.exports = {
    MetaFileError,
    lockCanonical,
    unlockCanonical,
    readScratch,
    parseScratch,
    assembleAndAppend,
    hashFile,
    hashPrefix,
    slugToTitle,
    isoMinuteTimestamp,
};
