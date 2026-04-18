const fs = require('fs');
const path = require('path');

const BASES = ['Plan.md', 'Build-Log.md', 'Build-Feedback.md'];
const WARZONE_BASE = 'WarZone.md';

// Parse a runtime task filename into its slug and base.
// `landing-page-Plan.md` → { slug: 'landing-page', base: 'Plan.md' }
// `Plan.md` (no slug)    → null
function parseTaskFile(filename) {
    for (const base of BASES) {
        const suffix = `-${base}`;
        if (filename.endsWith(suffix) && filename.length > suffix.length) {
            return { slug: filename.slice(0, -suffix.length), base };
        }
    }
    return null;
}

// `portfolio-WarZone.md` → 'portfolio'
// `WarZone.md`           → null
function parseWarzoneFile(filename) {
    const suffix = `-${WARZONE_BASE}`;
    if (filename.endsWith(suffix) && filename.length > suffix.length) {
        return filename.slice(0, -suffix.length);
    }
    return null;
}

// Move every live `<slug>-{Plan,Build-Log,Build-Feedback}.md` from WORK_DIR
// into Build-History/<slug>/, dropping the slug prefix on the way in.
// On slug collision (folder already exists), suffix the destination with an ISO timestamp.
// Best-effort — never throws; callers must remain functional even if archival hits a snag.
function archiveLiveFiles() {
    const WORK_DIR = process.env.WORK_DIR;
    if (!WORK_DIR || !fs.existsSync(WORK_DIR)) return;

    const HISTORY_DIR = path.join(WORK_DIR, 'Build-History');

    let entries;
    try {
        entries = fs.readdirSync(WORK_DIR);
    } catch (err) {
        console.warn(`[archive] Failed to read WORK_DIR: ${err.message}`);
        return;
    }

    const groups = new Map();
    for (const name of entries) {
        const parsed = parseTaskFile(name);
        if (!parsed) continue;
        if (!groups.has(parsed.slug)) groups.set(parsed.slug, []);
        groups.get(parsed.slug).push({ name, base: parsed.base });
    }

    if (groups.size === 0) return;

    try {
        fs.mkdirSync(HISTORY_DIR, { recursive: true });
    } catch (err) {
        console.warn(`[archive] Failed to create Build-History/: ${err.message}`);
        return;
    }

    for (const [slug, files] of groups) {
        let dest = path.join(HISTORY_DIR, slug);
        if (fs.existsSync(dest)) {
            const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            dest = `${dest}-${ts}`;
        }
        try {
            fs.mkdirSync(dest, { recursive: true });
        } catch (err) {
            console.warn(`[archive] Failed to create ${dest}: ${err.message}`);
            continue;
        }
        let moved = 0;
        for (const { name, base } of files) {
            const src = path.join(WORK_DIR, name);
            const dst = path.join(dest, base);
            try {
                fs.renameSync(src, dst);
                moved++;
            } catch (err) {
                console.warn(`[archive] Failed to move ${name}: ${err.message}`);
            }
        }
        const archiveName = path.relative(WORK_DIR, dest);
        console.log(`[archive] Moved ${slug} → ${archiveName}/ (${moved} file${moved === 1 ? '' : 's'})`);
    }
}

// Move the live `<slug>-WarZone.md` into WarZone-History/<slug>/WarZone.md.
// Slug-collision handling matches archiveLiveFiles: timestamp suffix on the dest folder.
// No-op if slug is null/empty or the file doesn't exist. Best-effort — never throws.
function archiveWarzoneFile(slug) {
    const WORK_DIR = process.env.WORK_DIR;
    if (!WORK_DIR || !slug) return;

    const src = path.join(WORK_DIR, `${slug}-${WARZONE_BASE}`);
    if (!fs.existsSync(src)) return;

    const HISTORY_DIR = path.join(WORK_DIR, 'WarZone-History');
    try {
        fs.mkdirSync(HISTORY_DIR, { recursive: true });
    } catch (err) {
        console.warn(`[archive] Failed to create WarZone-History/: ${err.message}`);
        return;
    }

    let dest = path.join(HISTORY_DIR, slug);
    if (fs.existsSync(dest)) {
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        dest = `${dest}-${ts}`;
    }
    try {
        fs.mkdirSync(dest, { recursive: true });
    } catch (err) {
        console.warn(`[archive] Failed to create ${dest}: ${err.message}`);
        return;
    }

    try {
        fs.renameSync(src, path.join(dest, WARZONE_BASE));
    } catch (err) {
        console.warn(`[archive] Failed to move ${slug}-${WARZONE_BASE}: ${err.message}`);
        return;
    }

    const archiveName = path.relative(WORK_DIR, dest);
    console.log(`[archive] Moved ${slug}-${WARZONE_BASE} → ${archiveName}/${WARZONE_BASE}`);
}

// Find the live warzone discussion's slug, if any. Used on hermes boot to re-derive
// state after restart. Exactly one match → that slug; zero → null; many → warn + most-recent.
function findLiveWarzoneSlug() {
    const WORK_DIR = process.env.WORK_DIR;
    if (!WORK_DIR || !fs.existsSync(WORK_DIR)) return null;
    let entries;
    try {
        entries = fs.readdirSync(WORK_DIR);
    } catch {
        return null;
    }
    const slugs = entries
        .map((name) => ({ name, slug: parseWarzoneFile(name) }))
        .filter((e) => e.slug !== null);
    if (slugs.length === 0) return null;
    if (slugs.length === 1) return slugs[0].slug;
    // Multiple — shouldn't happen. Warn and pick the most-recently-modified.
    console.warn(
        `[archive] Found ${slugs.length} live warzone files; expected at most 1. ` +
        `Using the most recently modified.`,
    );
    let newest = slugs[0];
    let newestMtime = 0;
    for (const e of slugs) {
        try {
            const mtime = fs.statSync(path.join(WORK_DIR, e.name)).mtimeMs;
            if (mtime > newestMtime) {
                newestMtime = mtime;
                newest = e;
            }
        } catch {
            /* ignore */
        }
    }
    return newest.slug;
}

const HISTORY_SLUG_RE = /^[a-zA-Z0-9_-]+$/;

// Validates that a caller-provided slug name is safe to use as a path segment under
// Build-History/ or WarZone-History/. Strict: alphanumeric + underscore + hyphen only.
// Prevents path traversal (../) and accidental access outside the history folder.
function isSafeSlug(slug) {
    return typeof slug === 'string' && HISTORY_SLUG_RE.test(slug);
}

// List archived build folders under WORK_DIR/Build-History/, newest first.
// Returns [{ slug, mtime }] where mtime is the folder's mtimeMs. Slug includes the
// timestamp suffix on collision-resolved continuations (e.g. landing-page-2026-04-17T15-30-12).
function listBuildHistory() {
    return listHistoryFolder('Build-History');
}

// List archived discussions under WORK_DIR/WarZone-History/, newest first.
function listDiscussionHistory() {
    return listHistoryFolder('WarZone-History');
}

function listHistoryFolder(historyName) {
    const WORK_DIR = process.env.WORK_DIR;
    if (!WORK_DIR) return [];
    const dir = path.join(WORK_DIR, historyName);
    if (!fs.existsSync(dir)) return [];
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
        console.warn(`[archive] Failed to list ${historyName}: ${err.message}`);
        return [];
    }
    const items = [];
    for (const e of entries) {
        if (!e.isDirectory()) continue;
        if (!isSafeSlug(e.name)) continue;
        try {
            const mtime = fs.statSync(path.join(dir, e.name)).mtimeMs;
            items.push({ slug: e.name, mtime });
        } catch {
            /* ignore unreadable entries */
        }
    }
    return items.sort((a, b) => b.mtime - a.mtime);
}

// Read all three meta files for one archived build, returning their raw markdown.
// Missing file = empty string (some archives may be partial — e.g. an aborted task
// that never reached the audit stage).
function readBuildHistory(slug) {
    if (!isSafeSlug(slug)) return null;
    const WORK_DIR = process.env.WORK_DIR;
    if (!WORK_DIR) return null;
    const dir = path.join(WORK_DIR, 'Build-History', slug);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return null;
    const readSafe = (name) => {
        try {
            return fs.readFileSync(path.join(dir, name), 'utf8');
        } catch {
            return '';
        }
    };
    return {
        plan: readSafe('Plan.md'),
        buildLog: readSafe('Build-Log.md'),
        buildFeedback: readSafe('Build-Feedback.md'),
    };
}

// Read the WarZone.md content for one archived discussion.
function readDiscussionHistory(slug) {
    if (!isSafeSlug(slug)) return null;
    const WORK_DIR = process.env.WORK_DIR;
    if (!WORK_DIR) return null;
    const dir = path.join(WORK_DIR, 'WarZone-History', slug);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return null;
    try {
        return { warzone: fs.readFileSync(path.join(dir, 'WarZone.md'), 'utf8') };
    } catch {
        return { warzone: '' };
    }
}

// System folders that should never appear as "projects" in the UI selector.
// Anything else that's a directory in WORK_DIR is treated as a per-task deliverable folder.
const SYSTEM_FOLDERS = new Set([
    'Build-History',
    'WarZone-History',
    'node_modules',
    '.claude',
    '.gemini',
    '.codex',
    '.git',
]);

// Returns the list of <slug>/ deliverable folders currently in WORK_DIR.
// Used by GET /projects so the Build UI can offer "Continue: <slug>" options.
// Sorted alphabetically. Hidden entries (dotfiles) and system folders are excluded.
function listProjectFolders() {
    const WORK_DIR = process.env.WORK_DIR;
    if (!WORK_DIR || !fs.existsSync(WORK_DIR)) return [];
    let entries;
    try {
        entries = fs.readdirSync(WORK_DIR, { withFileTypes: true });
    } catch (err) {
        console.warn(`[archive] Failed to list projects: ${err.message}`);
        return [];
    }
    return entries
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .filter((name) => !name.startsWith('.') && !SYSTEM_FOLDERS.has(name))
        .sort();
}

module.exports = {
    archiveLiveFiles,
    archiveWarzoneFile,
    findLiveWarzoneSlug,
    isSafeSlug,
    listBuildHistory,
    listDiscussionHistory,
    listProjectFolders,
    parseTaskFile,
    parseWarzoneFile,
    readBuildHistory,
    readDiscussionHistory,
    BASES,
    WARZONE_BASE,
};
