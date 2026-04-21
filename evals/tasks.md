# Argus Baseline Eval — Task Spec

**Status:** FROZEN 2026-04-21. No edits after the first run.
**Branch:** `eval-baseline`
**Output file:** `evals/comparison.md` (written during/after runs)
**Seed files:** `evals/seed/task-*/` — immutable. `chmod -w` at eval start.

---

## Protocol

- **10 tasks × 2 pipelines** = 20 runs. Argus via the UI (POST /task), solo-Claude via `claude -p` in the terminal.
- **Argus iteration cap: 2.** Regardless of grade trajectory. If grade hasn't reached A by iteration 2, the task is recorded with its final grade and the result determined by the rubric. No manual approvals to squeeze a third iteration.
- **Solo-Claude: 1 invocation.** No retries. If it fails, it fails.
- **Same prompt text.** For each task, the "Prompt" field below is sent to Argus as-is. For solo-Claude, prefix with `Build this end-to-end yourself, don't plan separately. ` then paste the same prompt. Record the exact solo-Claude prompt in `comparison.md`.
- **Runs interleaved.** Task 01 Argus → task 01 solo → task 02 Argus → task 02 solo → ... — not all Argus first, then all solo. Prevents grader drift.
- **Rubric frozen.** The pass / partial / fail criteria below are final. If an edge case surfaces mid-run that the rubric doesn't cover, grade "partial" and note it in `comparison.md`. Rubric modifications during runs corrupt the eval.
- **Blind grading where possible.** For each task, view both output folders side-by-side before checking which produced which, then grade against the rubric.

## Per-run mechanics

**Argus (web pages, CLIs, data transforms — tasks 01–07):**
1. Open Argus UI, Build tab.
2. Submit the task's "Prompt" field verbatim via the task input.
3. Wait for DONE. Note the task_id from the UI.
4. Query wall-time and grade:
   ```sql
   SELECT id,
          (julianday(completed_at) - julianday(created_at)) * 86400 AS wall_s,
          iterations, final_grade
   FROM tasks WHERE id = <task_id>;
   ```
5. Grade the resulting folder under `Indy-Test/<slug>/` against the rubric.

**Argus (seed-based tasks 08, 09, 10):**
1. Before submitting, copy seed into WORK_DIR:
   ```bash
   cp -R /Users/karinganageshgoud/Desktop/Karinga.dev/NK-Base/evals/seed/task-NN/ \
         /Users/karinganageshgoud/Desktop/Karinga.dev/Indy-Test/task-NN-argus/
   ```
2. Submit the prompt via UI. Prompt references `task-NN-argus/<seed-file>`.
3. DONE → query DB → grade.

**Solo-Claude (all tasks):**
1. Set up working dir and seed if needed:
   ```bash
   mkdir -p /Users/karinganageshgoud/Desktop/Karinga.dev/Indy-Test/task-NN-solo
   cp -R /Users/karinganageshgoud/Desktop/Karinga.dev/NK-Base/evals/seed/task-NN/* \
         /Users/karinganageshgoud/Desktop/Karinga.dev/Indy-Test/task-NN-solo/ 2>/dev/null || true
   cd /Users/karinganageshgoud/Desktop/Karinga.dev/Indy-Test/task-NN-solo
   ```
2. Invoke (tool pre-approval mirrors what Argus gives its Claude planner + Gemini builder + Codex auditor across the pipeline):
   ```bash
   time claude --allowedTools Edit Write Read Glob Grep Bash -p "Build this end-to-end yourself, don't plan separately. <PROMPT>" < /dev/null
   ```
3. Record `real` from `time` output as wall-time in seconds. Wall-times from runs before the `--allowedTools` fix (where Claude exited waiting for permission) are discarded.
4. Grade the folder against the rubric.

## What gets recorded

For each task in `comparison.md`:
- Argus: `task_id`, `iterations`, `final_grade`, `wall_s`, `result` (pass/partial/fail), any rubric-edge notes
- Solo-Claude: `wall_s`, `result`, any rubric-edge notes, **exact prompt text sent**

---

## Tasks

### Task 01 — Personal portfolio

**Category:** Web page
**Seed:** none

**Prompt:**
> Build a single-page personal portfolio website. Include: hero section with name and tagline, about section with 3 placeholder paragraphs, 3 project cards (each with a title, 2-sentence description, and a tech-stack list), a contact form with name/email/message fields (no backend — just the HTML form), and a footer with 3 social links. Must be responsive, working at both 375px (mobile) and 1024px (desktop) widths. Single HTML file plus an external CSS file. No JS frameworks.

**Verification:** open `index.html` in browser, resize DevTools viewport to 375px then 1024px

**Rubric:**
- **pass:** all 5 sections render + responsive at both 375px and 1024px + contact form has 3 input fields + no console errors
- **partial:** 4 of 5 sections present, OR responsive broken at one breakpoint, OR 1–2 console errors with structure otherwise correct
- **fail:** fewer than 4 sections, OR doesn't render

---

### Task 02 — Recipe card

**Category:** Web page
**Seed:** none

**Prompt:**
> Build a recipe card webpage for Pasta Carbonara. Include: a hero image placeholder (use a CSS-styled div with a background color — not a real image), an ingredients list with at least 6 items including quantities (e.g. "200g spaghetti"), a numbered step-by-step instructions section with at least 5 steps, and print-friendly CSS (use `@media print` to hide navigation and ensure the recipe fits one page). Single HTML file plus an external CSS file.

**Verification:** open in browser + `Cmd+P` → check the print preview

**Rubric:**
- **pass:** hero placeholder + ingredients list (6+ items with quantities) + numbered steps (5+) + print-preview looks clean (no nav chrome, readable fonts, fits one page)
- **partial:** all visual sections present but print CSS missing or broken, OR fewer than 6 ingredients or 5 steps (but at least 4 of each)
- **fail:** missing 2+ sections, OR doesn't render

---

### Task 03 — Tic-tac-toe

**Category:** Web page + code execution
**Seed:** none

**Prompt:**
> Build a 2-player tic-tac-toe game as a single HTML file with vanilla JavaScript — no frameworks. X and O alternate turns. The game must detect wins (rows, columns, diagonals), detect a draw when the board is full with no winner, display a status message showing whose turn it is and who won, and have a reset button. Clicks on already-filled squares should do nothing.

**Verification:** play 3 full games — one X-win, one O-win, one draw — and click reset between each

**Rubric:**
- **pass:** X win detected correctly + O win detected correctly + draw detected correctly + reset clears the board and status + no console errors
- **partial:** one of the five conditions broken (e.g. draw not detected, or reset doesn't clear status)
- **fail:** doesn't render, OR clicks don't register, OR crashes mid-game, OR two+ conditions broken

---

### Task 04 — Word counter CLI

**Category:** CLI + code execution
**Seed:** none

**Prompt:**
> Build a Node.js CLI tool that counts characters, words, and lines in its input. It should accept input in two ways: (1) a filename as the first argument (`node index.js myfile.txt`), or (2) if no argument is given, read from stdin. Output exactly three lines in this format: `characters: N`, `words: N`, `lines: N` — where characters includes whitespace, words are whitespace-separated tokens, and lines are counted by newline characters.

**Verification:**
```bash
printf 'hello world\nfoo bar baz\n' | node index.js
# expect: characters: 24, words: 5, lines: 2
echo 'one two three' > /tmp/wc-test.txt && node index.js /tmp/wc-test.txt
# expect: characters: 14, words: 3, lines: 1
```

**Rubric:**
- **pass:** both stdin and file-arg modes work + all 3 counts correct on both test inputs + output format matches spec exactly
- **partial:** one mode works but not the other, OR counts off by 1 consistently (e.g. lines counted without trailing newline), OR output format deviates but numbers correct
- **fail:** throws, hangs, or counts wildly wrong

---

### Task 05 — JSON pretty-printer CLI

**Category:** CLI + code execution
**Seed:** none

**Prompt:**
> Build a Node.js CLI that pretty-prints JSON. Usage: `node index.js file.json` or piped via stdin. Output the JSON indented with 2 spaces. Support a `--sort-keys` flag that alphabetically sorts object keys recursively at every level (not just top-level). Invalid JSON should exit with a non-zero status and an error message on stderr.

**Verification:**
```bash
echo '{"b":2,"a":1,"nested":{"z":1,"a":2}}' | node index.js --sort-keys
# expect top-level keys in order: a, b, nested; nested keys in order: a, z
echo 'not json' | node index.js 2>/dev/null; echo "exit: $?"
# expect exit: non-zero
```

**Rubric:**
- **pass:** 2-space indent + `--sort-keys` recursively sorts + both stdin and file modes work + invalid JSON returns non-zero exit
- **partial:** sort only at top level, OR file mode broken while stdin works, OR invalid JSON doesn't return non-zero
- **fail:** doesn't run, OR produces malformed JSON output

---

### Task 06 — Markdown table to JSON

**Category:** Data transform + code execution
**Seed:** `evals/seed/task-06/table.md`

**Prompt:**
> Build a Node.js CLI that converts a markdown table to a JSON array. Usage: `node index.js path/to/table.md`. The input file contains one markdown table — a header row, a separator row of dashes, and one or more data rows. Convert it to a JSON array where each data row becomes an object keyed by the header column name. All values stay as strings. Trim leading and trailing whitespace from cell values. The seed file is at `task-06-<runner>/table.md`.

**Verification:** run against the seed and compare to expected output:
```json
[
  {"Name": "Alice", "Age": "30", "City": "New York"},
  {"Name": "Bob", "Age": "25", "City": "San Francisco"},
  {"Name": "Charlie", "Age": "35", "City": "Chicago"},
  {"Name": "Dana", "Age": "28", "City": "Boston"}
]
```

**Rubric:**
- **pass:** output is valid JSON + array of 4 objects + exact header names as keys + all values as trimmed strings + no extra rows (separator row excluded)
- **partial:** structure correct but 1 row missing, OR whitespace not trimmed, OR separator row included with value like "---"
- **fail:** not valid JSON, OR fewer than 3 rows, OR doesn't run

---

### Task 07 — Nginx log parser

**Category:** Data transform + code execution
**Seed:** `evals/seed/task-07/access.log`

**Prompt:**
> Build a Python CLI that reads an nginx-style access log and outputs the top 10 source IPs by request count. Each log line starts with an IP in dotted-quad format (`\d+\.\d+\.\d+\.\d+`). Output format: 10 lines of `<count> <ip>`, sorted by count descending. Usage: `python3 main.py path/to/access.log`. The seed file is at `task-07-<runner>/access.log`.

**Verification:** run against the seed; expected output:
```
50 10.0.0.1
30 10.0.0.2
25 10.0.0.3
20 10.0.0.4
18 10.0.0.5
15 10.0.0.6
12 10.0.0.7
10 10.0.0.8
8 10.0.0.9
7 10.0.0.10
```

**Rubric:**
- **pass:** 10 lines of output + correct IPs + correct counts + correct descending order + format matches (count space IP)
- **partial:** correct IPs but counts off, OR order wrong at ties, OR format mildly different (e.g. IP before count, or tab-separated)
- **fail:** doesn't run, OR fewer than 8 correct lines, OR completely wrong output

---

### Task 08 — Refactor monolithic JS into modules

**Category:** Refactor
**Seed:** `evals/seed/task-08/app.js` + `evals/seed/task-08/index.html`

**Prompt:**
> The file `task-08-<runner>/app.js` is a monolithic script that mixes three responsibilities: fetching data from an API, transforming/filtering/sorting the response, and rendering HTML to the DOM. Refactor it into three single-responsibility ES modules: `api.js` (fetch only — exports a function that returns the raw API response), `parser.js` (data transforms only — exports functions that take raw data and return the internal shape, filter, sort, and compute stats), and `view.js` (DOM rendering only — exports a function that takes the prepared data and renders it). Keep `app.js` as the entry point that imports from the three modules and wires them together. Behavior must be unchanged. Also update `index.html`'s `<script>` tag to use `type="module"`. Produce the refactored version in a new folder (Argus will create its slug; solo-Claude should output to `refactored/`).

**Verification:** read each file; confirm single responsibility per module; trace one execution path through the imports

**Rubric:**
- **pass:** 4 JS files (app.js, api.js, parser.js, view.js) + each module has exactly one responsibility (api has only fetch, parser has only transforms/filter/sort/stats, view has only DOM ops) + ES module syntax (`import`/`export`) + `index.html` uses `type="module"` + imports chain correctly (no circular or missing)
- **partial:** split done but one module has leaky responsibility (e.g. view.js still does transforms), OR uses CommonJS instead of ES modules, OR `index.html` not updated
- **fail:** no split, OR modules don't import each other correctly, OR output references missing files

---

### Task 09 — Debug parallel file reader

**Category:** Debug + code execution
**Seed:** `evals/seed/task-09/parallel-read.js` + `evals/seed/task-09/package.json`

**Prompt:**
> The file `task-09-<runner>/parallel-read.js` exports `readFiles(paths)` — it's supposed to read the given file paths in parallel and return an array of their contents in the same order as the input paths. It has a bug: the returned array is in the order each read finished, not the input order (because results get pushed inside `Promise.all`'s callback in completion order). Fix the bug. Then add a `test.js` file in the same folder that: (1) writes three temp files with distinct known contents, (2) calls `readFiles` with the paths in a specific order, (3) asserts the returned array matches that input order. Run the test with `node test.js` and make sure it prints a passing message.

**Verification:** `cd` into the folder, run `node test.js`, check for a passing assertion

**Rubric:**
- **pass:** bug fixed (returned array is in input-path order) + `test.js` exists + `node test.js` runs to completion + test prints a pass/success message + assertion is not trivially vacuous (actually compares order across 3 different contents)
- **partial:** bug fixed but test missing, OR test exists but doesn't actually run, OR test passes but only because it tests 1 file (vacuous order)
- **fail:** bug not fixed (still returns finish-order), OR test throws

---

### Task 10 — Debug running-average

**Category:** Debug + code execution
**Seed:** `evals/seed/task-10/running_average.py` + `evals/seed/task-10/requirements.txt`

**Prompt:**
> The file `task-10-<runner>/running_average.py` defines `running_average(numbers)` — it's supposed to return the cumulative running average (after each element). For input `[10, 20, 30]` expected output is `[10.0, 15.0, 20.0]`. It has two bugs: (1) the `count` variable is off-by-one (set from `i` instead of `i+1`), (2) the final division has operand order reversed (`count / total` instead of `total / count`). Fix both bugs. Add a `test_running_average.py` in the same folder with at least two assertions testing non-trivial inputs (lists of 3+ numbers, at least one case where the expected results are decimal values). Install pytest via `pip install -r requirements.txt` if needed, then run `pytest` and make sure all tests pass.

**Verification:** `cd` into the folder, `pytest -v`, check for all tests passing

**Rubric:**
- **pass:** both bugs fixed (function produces correct output for `[10,20,30]` → `[10.0,15.0,20.0]` and a decimal-result case) + `test_running_average.py` exists + 2+ assertions + `pytest` runs and reports all tests pass
- **partial:** one bug fixed not both (output numerically wrong but not crashing), OR test file missing, OR test runs but uses only integer inputs / only 1 assertion, OR tests don't actually execute
- **fail:** bugs not fixed, OR pytest errors out, OR test file doesn't exist

---

## Results table (fill during session)

| # | Task | Argus task_id | Argus grade | Argus iter | Argus wall (s) | Argus result | Solo wall (s) | Solo result |
|---|---|---|---|---|---|---|---|---|
| 01 | Portfolio | 43 | A | 1 | 178.28 | pass | 64.67 | pass |
| 02 | Recipe card | 44 | B | 2 | 385.29 | pass | 56.57 | pass |
| 03 | Tic-tac-toe | 45 | A | 1 | 128.75 | pass | 27.06 | pass |
| 04 | Word counter | 46 | A | 1 | 161.32 | pass | 19.95 | pass |
| 05 | JSON pretty | 47 | A | 2 | 303.55 | pass | 21.04 | pass |
| 06 | MD → JSON | 48 | C | 2 | 460.26 | pass* | 20.12 | pass |
| 07 | Log parser | 49 | A | 1 | 186.32 | pass | 15.93 | pass |
| 08 | JS refactor | 50 | A | 1 | 206.37 | pass | 54.59 | pass |
| 09 | Parallel-read debug | 51 | A | 1 | 137.81 | pass | 26.40 | pass |
| 10 | Running-avg debug | 52 | A | 1 | 156.32 | pass | 28.79 | pass |

## Summary (frozen 2026-04-21 after all runs)

- **Argus:** 10 pass / 0 partial / 0 fail (task 06 is `pass*` — parser rubric-correct, Codex C was eval-protocol artifact)
- **Solo-Claude:** 10 pass / 0 partial / 0 fail
- **Mean Argus wall-time:** 230.4 s (median 182.3 s)
- **Mean solo-Claude wall-time:** 33.5 s (median 26.7 s)
- **Wall-time gap:** ~6.88× (mean), ~6.8× (median)
- **Argus first-grade-A rate:** 7 / 10
- **Argus reached-A rate (within 2 iterations):** 8 / 10
- **Mean Argus iterations-to-completion:** 1.3
- **Argus audit caught a real issue:** task 06 (Codex's C correctly reflected that the build couldn't run end-to-end against the seed — audit fired honestly even though the parser itself was sound)
- **Cases where solo passed but Argus didn't (or vice versa):** 0 rubric-level divergences

## Observations (fill after all runs)

A few paragraphs of honest interpretation. Not a sales pitch. Where did the pipeline help? Where did it hurt? What would change if this same eval were run in 6 months?
