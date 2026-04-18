const fs = require('fs');
const path = require('path');

/**
 * On hermes boot, ensure WORK_DIR has the three role-doc folders the agents
 * read (.claude/, .gemini/, .codex/). If any are missing, copy them from the
 * argus clone where they ship.
 *
 * Idempotent: if a folder already exists in WORK_DIR, leave it alone (the
 * user may have customized it).
 *
 * Does NOT create WORK_DIR if it doesn't exist — that's a setup error the
 * user should fix. We log a warning and skip.
 */
function ensureRoleDocs() {
    const WORK_DIR = process.env.WORK_DIR;
    if (!WORK_DIR) {
        console.warn('[role-docs] WORK_DIR not set in env — skipping role-doc check');
        return;
    }
    if (!fs.existsSync(WORK_DIR)) {
        console.warn(
            `[role-docs] WORK_DIR does not exist: ${WORK_DIR}\n` +
            '            Create it (or fix the path in hermes/.env) and restart hermes.',
        );
        return;
    }

    // role-docs.js lives at <argus>/hermes/core/role-docs.js
    // → __dirname is <argus>/hermes/core
    // → ../.. is <argus>
    const ARGUS_ROOT = path.resolve(__dirname, '..', '..');

    const ROLE_DOC_FOLDERS = ['.claude', '.gemini', '.codex'];

    for (const folder of ROLE_DOC_FOLDERS) {
        const src  = path.join(ARGUS_ROOT, folder);
        const dest = path.join(WORK_DIR,  folder);

        if (fs.existsSync(dest)) continue; // user already has it — don't overwrite
        if (!fs.existsSync(src)) {
            console.warn(`[role-docs] Source missing in argus clone: ${src} — skipping`);
            continue;
        }

        try {
            fs.cpSync(src, dest, { recursive: true });
            console.log(
                `[role-docs] Copied ${folder} → ${WORK_DIR}/${folder} ` +
                '(see README for the manual setup alternative)',
            );
        } catch (err) {
            console.warn(`[role-docs] Failed to copy ${folder}: ${err.message}`);
        }
    }
}

module.exports = { ensureRoleDocs };
