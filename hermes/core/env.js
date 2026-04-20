const fs = require('fs');

// Validate env vars on server boot. Fail fast with a clear message — missing vars
// otherwise surface as confusing downstream errors (agents failing, paths not
// resolving, ws connections dropped mid-task).
//
// `required` → array of env var names that must be present and non-empty.
// `recommend` → array of names that should be set but aren't strictly fatal; logged
//   as a warning so the operator sees them without the server refusing to boot.
// Additional invariant: WORK_DIR, when present, must point at an existing directory.
function validateEnv(serverName, { required = [], recommend = [] } = {}) {
    const missing = required.filter((key) => !process.env[key] || !process.env[key].trim());
    const warn = recommend.filter((key) => !process.env[key] || !process.env[key].trim());

    if (missing.length > 0) {
        console.error(
            `[${serverName}] Missing required env var(s): ${missing.join(', ')}.\n` +
            `       Set them in hermes/.env and restart.`,
        );
        process.exit(1);
    }

    if (process.env.WORK_DIR) {
        if (!fs.existsSync(process.env.WORK_DIR)) {
            console.error(
                `[${serverName}] WORK_DIR points to a directory that does not exist: ${process.env.WORK_DIR}\n` +
                `       Create it or update hermes/.env.`,
            );
            process.exit(1);
        }
        try {
            const st = fs.statSync(process.env.WORK_DIR);
            if (!st.isDirectory()) {
                console.error(`[${serverName}] WORK_DIR is not a directory: ${process.env.WORK_DIR}`);
                process.exit(1);
            }
        } catch (err) {
            console.error(`[${serverName}] WORK_DIR stat failed: ${err.message}`);
            process.exit(1);
        }
    }

    for (const key of warn) {
        console.warn(`[${serverName}] ${key} is not set — feature may not work correctly.`);
    }
}

module.exports = { validateEnv };
