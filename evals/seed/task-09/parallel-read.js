const fs = require('fs').promises;

// Reads the given list of file paths in parallel.
// Expected contract: returned array is in the same order as the input paths.
// Actual behavior: returned array is in the order each read finished, not input order.
async function readFiles(paths) {
  const results = [];
  await Promise.all(
    paths.map(async (p) => {
      const content = await fs.readFile(p, 'utf8');
      results.push(content);
    })
  );
  return results;
}

module.exports = { readFiles };
