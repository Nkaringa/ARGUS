# Argus Baseline Eval — Comparison Results

**Run start:** 2026-04-21
**Branch:** `eval-baseline`
**Frozen spec:** `evals/tasks.md`
**Argus iteration cap:** 2 (enforced by protocol, not yet enforced in code)
**Solo-Claude invocation template:**
```bash
time claude --allowedTools Edit Write Read Glob Grep Bash -p \
  "Build this end-to-end yourself, don't plan separately. <PROMPT>" < /dev/null
```

---

## Task 01 — Personal portfolio

**Argus**
- task_id: 43
- iterations: 1
- final_grade: A
- wall-time: 178.28s
- output folder: `Indy-Test/portfolio/`
- result: **pass**
- notes: all 5 sections present, responsive at 375px + 1024px, 3 contact fields, no console errors

**Solo-Claude**
- wall-time: 64.67s
- output folder: `Indy-Test/task-01-solo/`
- result: **pass**
- notes: all 5 sections present, responsive at 375px + 1024px, 3 contact fields, no console errors; bonus sticky nav + focus states + reduced-motion support
- exact prompt sent: `Build this end-to-end yourself, don't plan separately. Build a single-page personal portfolio website. Include: hero section with name and tagline, about section with 3 placeholder paragraphs, 3 project cards (each with a title, 2-sentence description, and a tech-stack list), a contact form with name/email/message fields (no backend — just the HTML form), and a footer with 3 social links. Must be responsive, working at both 375px (mobile) and 1024px (desktop) widths. Single HTML file plus an external CSS file. No JS frameworks.`

---

## Task 02 — Recipe card (Pasta Carbonara)

**Argus**
- task_id: 44
- iterations: 2 (cap hit; both iterations graded B)
- final_grade: B
- wall-time: 385.29s
- output folder: `Indy-Test/carbonara-recipe/`
- result: **pass**
- notes: 8 ingredients with quantities, 6 numbered steps, hero placeholder (yellow gradient), print preview fits one page (1/1), no nav chrome. Codex's B did not reflect a rubric-level miss.

**Solo-Claude**
- wall-time: 56.57s
- output folder: `Indy-Test/task-02-solo/`
- result: **pass**
- notes: 8 ingredients with quantities, 6 numbered steps, hero placeholder (gray block), print preview fits one page (1/1), no nav chrome; fades hero to neutral in print (stylistic polish beyond spec)
- exact prompt sent: `Build this end-to-end yourself, don't plan separately. Build a recipe card webpage for Pasta Carbonara. Include: a hero image placeholder (use a CSS-styled div with a background color — not a real image), an ingredients list with at least 6 items including quantities (e.g. '200g spaghetti'), a numbered step-by-step instructions section with at least 5 steps, and print-friendly CSS (use @media print to hide navigation and ensure the recipe fits one page). Single HTML file plus an external CSS file.`

**Observation:** Argus spent ~6.8x the wall-time (385s vs 57s) and two iterations to land on a B that passed the rubric. Solo hit pass in 1 minute. First honest data point for the eval.

---

## Task 03 — Tic-tac-toe

**Argus**
- task_id: 45
- iterations: 1
- final_grade: A
- wall-time: 128.75s
- output folder: `Indy-Test/tic-tac-toe/`
- result: **pass**
- notes: X-win detected, O-win detected, draw detected, reset clears board, filled-cell clicks no-op, no console errors

**Solo-Claude**
- wall-time: 27.06s
- output folder: `Indy-Test/task-03-solo/`
- result: **pass**
- notes: single-file `tic-tac-toe.html`, all 5 rubric conditions satisfied, winning cells highlighted
- exact prompt sent: `Build this end-to-end yourself, don't plan separately. Build a 2-player tic-tac-toe game as a single HTML file with vanilla JavaScript — no frameworks. X and O alternate turns. The game must detect wins (rows, columns, diagonals), detect a draw when the board is full with no winner, display a status message showing whose turn it is and who won, and have a reset button. Clicks on already-filled squares should do nothing.`

**Observation:** Argus 128s vs solo 27s (~4.8x). Both reached rubric pass with full correctness. Solo was the fastest run of the eval so far.

---

## Task 04 — Word counter CLI

**Argus**
- task_id: 46
- iterations: 1
- final_grade: A
- wall-time: 161.32s
- output folder: `Indy-Test/wc-cli/`
- result: **pass**
- notes: stdin test → characters:24, words:5, lines:2 (exact match); file test → characters:14, words:3, lines:1 (exact match)

**Solo-Claude**
- wall-time: 19.95s
- output folder: `Indy-Test/task-04-solo/`
- result: **pass**
- notes: same exact matches on both test cases; solo also created its own `sample.txt` fixture for self-test (ignored for grading)
- exact prompt sent: `Build this end-to-end yourself, don't plan separately. Build a Node.js CLI tool that counts characters, words, and lines in its input. It should accept input in two ways: (1) a filename as the first argument (node index.js myfile.txt), or (2) if no argument is given, read from stdin. Output exactly three lines in this format: characters: N, words: N, lines: N — where characters includes whitespace, words are whitespace-separated tokens, and lines are counted by newline characters.`

**Observation:** Argus 161s vs solo 20s (~8x). Both perfectly correct on both test cases.

---

## Task 05 — JSON pretty-printer CLI

**Argus**
- task_id: 47
- iterations: 2
- final_grade: A
- wall-time: 303.55s
- output folder: `Indy-Test/json-prettify-cli/` (index.js + package.json + README.md)
- result: **pass**
- notes: sort-keys recurses top+nested correctly; file mode correct indent; invalid JSON exits 1 with stderr message

**Solo-Claude**
- wall-time: 21.04s
- output folder: `Indy-Test/task-05-solo/`
- result: **pass**
- notes: byte-identical output to Argus on all 3 tests including the exact error message text
- exact prompt sent: `Build this end-to-end yourself, don't plan separately. Build a Node.js CLI that pretty-prints JSON. Usage: node index.js file.json or piped via stdin. Output the JSON indented with 2 spaces. Support a --sort-keys flag that alphabetically sorts object keys recursively at every level (not just top-level). Invalid JSON should exit with a non-zero status and an error message on stderr.`

**Observation:** Argus 303s (2 iter) vs solo 21s (~14x). Both outputs byte-identical on every test. This is the worst gap so far — Argus's second iteration did not produce a rubric-visible advantage over solo's one-shot.

---

## Task 06 — Markdown table to JSON

**Argus**
- task_id: 48
- iterations: 2
- final_grade: **C** (from Codex)
- wall-time: 460.26s
- output folder: `Indy-Test/md-table-to-json/` (index.js + package.json + README.md + its own bundled table.md for self-test)
- result: **pass\*** — parser is correct against the real seed (identical output to solo); Codex's C reflects an eval-protocol miss (the expected `task-06-argus/table.md` was never copied into WORK_DIR before the build, so Codex's audit run hit ENOENT)

**Solo-Claude**
- wall-time: 20.12s
- output folder: `Indy-Test/task-06-solo/`
- result: **pass**
- notes: valid JSON array, 4 objects, Name/Age/City keys, values as trimmed strings, no separator row
- exact prompt sent: `Build this end-to-end yourself, don't plan separately. Build a Node.js CLI that converts a markdown table to a JSON array. Usage: node index.js path/to/table.md. The input file contains one markdown table — a header row, a separator row of dashes, and one or more data rows. Convert it to a JSON array where each data row becomes an object keyed by the header column name. All values stay as strings. Trim leading and trailing whitespace from cell values. The seed file is at ./table.md.`

**Observation:** First rubric-scoring divergence from Codex. Argus's parser is correct (verified post-hoc against the real seed), but Codex graded C because the build couldn't be audited end-to-end without the seed in place — a correct Codex judgment given what it saw. This is a real eval learning: seed-based tasks require the seed copy step to be done before `submit` for Codex to have a fair audit. From here on, treat the pre-Argus seed copy as a blocking prerequisite, not optional.

---

## Task 07 — Nginx log parser

**Argus**
- task_id: 49
- iterations: 1
- final_grade: A
- wall-time: 186.32s
- output folder: `Indy-Test/top-ips-cli/` (main.py + a self-generated access.log fixture — unrelated to our seed)
- result: **pass**
- notes: parser produces exact expected output against real seed (50/30/25/20/18/15/12/10/8/7 with IPs 10.0.0.1–10.0.0.10 in descending order)
- eval-protocol note: pre-Argus seed copy was again skipped; Gemini bundled its own access.log during build so Codex had something to audit this time (unlike task 06 where nothing was bundled)

**Solo-Claude**
- wall-time: 15.93s (new fastest)
- output folder: `Indy-Test/task-07-solo/`
- result: **pass**
- notes: exact expected output using `collections.Counter`
- exact prompt sent: `Build this end-to-end yourself, don't plan separately. Build a Python CLI that reads an nginx-style access log and outputs the top 10 source IPs by request count. Each log line starts with an IP in dotted-quad format. Output format: 10 lines of count-space-ip, sorted by count descending. Usage: python3 main.py path/to/access.log. The seed file is at ./access.log.`

**Observation:** Largest gap yet — Argus 186s vs solo 16s (~11.7x). Both parsers correct against real seed.

---

## Task 08 — Refactor monolithic JS into modules

**Argus**
- task_id: 50
- iterations: 1
- final_grade: A
- wall-time: 206.37s
- output folder: `Indy-Test/user-list-modules/`
- result: **pass**
- notes: api.js=fetch, parser.js=parseUsers+filterValidUsers+sortUsersByName+computeStats, view.js=renderUsers+renderError, app.js=sequential wiring with intermediate vars, ES modules, index.html has type="module"

**Solo-Claude**
- wall-time: 54.59s
- output folder: `Indy-Test/task-08-solo/refactored/`
- result: **pass**
- notes: api.js=fetch (API_URL kept module-private), parser.js=transformUsers+filterValidUsers+sortByName+computeStats, view.js=renderUsers+renderError, app.js=functional composition pipeline, ES modules, index.html has type="module"
- exact prompt sent: `Build this end-to-end yourself, don't plan separately. The file app.js in this folder is a monolithic script that mixes three responsibilities: fetching data from an API, transforming/filtering/sorting the response, and rendering HTML to the DOM. Refactor it into three single-responsibility ES modules: api.js (fetch only — exports a function that returns the raw API response), parser.js (data transforms only — exports functions that take raw data and return the internal shape, filter, sort, and compute stats), and view.js (DOM rendering only — exports a function that takes the prepared data and renders it). Keep app.js as the entry point that imports from the three modules and wires them together. Behavior must be unchanged. Also update index.html's script tag to use type=module. Produce the refactored version in a new folder called refactored/.`

**Observation:** Argus 206s vs solo 55s (~3.8x — tightest gap yet). Both refactorings are structurally equivalent with only minor stylistic differences. Neither demonstrates a rubric-visible advantage. Refactor tasks appear to compress Argus's time-to-advantage more than greenfield tasks — possibly because the plan-then-build separation is less useful when the structure is already prescribed.

---

## Task 09 — Debug parallel file reader

**Argus**
- task_id: 51
- iterations: 1
- final_grade: A
- wall-time: 137.81s
- output folder: `Indy-Test/task-09-argus/` (wrote fix in-place — no new slug folder created)
- result: **pass**
- notes: fix uses `return Promise.all(paths.map(...))`; test writes 3 files (ALPHA/BRAVO/CHARLIE), shuffles input order deliberately to [c, a, b], asserts deepStrictEqual. Test would catch the original bug. Exit 0 with `PASS: readFiles preserves input order`

**Solo-Claude**
- wall-time: 26.40s
- output folder: `Indy-Test/task-09-solo/`
- result: **pass**
- notes: byte-identical fix; test uses wildly different file sizes (250KB/5B/70KB) so reads finish out of order — would also catch the bug. Exit 0 with `PASS: readFiles returns contents in input-path order`
- exact prompt sent: `Build this end-to-end yourself, don't plan separately. The file parallel-read.js in this folder exports readFiles(paths) — it's supposed to read the given file paths in parallel and return an array of their contents in the same order as the input paths. It has a bug: the returned array is in the order each read finished, not the input order (because results get pushed inside Promise.all's callback in completion order). Fix the bug. Then add a test.js file in the same folder that: (1) writes three temp files with distinct known contents, (2) calls readFiles with the paths in a specific order, (3) asserts the returned array matches that input order. Run the test with 'node test.js' and make sure it prints a passing message.`

**Observation:** Argus 138s vs solo 26s (~5.2x). Both correct on the fix AND both wrote non-vacuous tests that would actually catch the original bug. Argus notably violated its own planner role doc by modifying files in the seed folder instead of creating a new slug folder — operationally correct (user interpretation of the task) but technically off-spec.

---

## Task 10 — Debug running-average

**Argus**
- task_id: 52
- iterations: 1
- final_grade: A
- wall-time: 156.32s
- output folder: `Indy-Test/task-10-argus/` (in-place again)
- result: **pass**
- notes: both bugs fixed (`count = i + 1`, `avg = total / count`). 4 pytest cases: integers [10,20,30], decimals [1,2,4,8] with `pytest.approx`, negatives [-10,-20,30], single-element [5]. All 4 pass in 0.03s.

**Solo-Claude**
- wall-time: 28.79s
- output folder: `Indy-Test/task-10-solo/`
- result: **pass**
- notes: byte-identical fix. 3 pytest cases: integers [10,20,30], decimals [1,2,3,4], non-terminating [1,2,2,5,10] with abs-tolerance. All 3 pass in 0.01s.
- exact prompt sent: `Build this end-to-end yourself, don't plan separately. The file running_average.py in this folder defines running_average(numbers) — it's supposed to return the cumulative running average (after each element). For input [10, 20, 30] expected output is [10.0, 15.0, 20.0]. It has two bugs: (1) the count variable is off-by-one (set from i instead of i+1), (2) the final division has operand order reversed (count / total instead of total / count). Fix both bugs. Add a test_running_average.py in the same folder with at least two assertions testing non-trivial inputs (lists of 3+ numbers, at least one case where the expected results are decimal values). Install pytest via 'pip install -r requirements.txt' if needed, then run 'pytest' and make sure all tests pass.`

**Observation:** Argus 156s vs solo 29s (~5.4x). Argus wrote one extra test (edge case for single-element input) — a small bonus beyond the rubric minimum. Both correct and non-vacuous.

---

## Summary — 10-task baseline (2026-04-21)

### Results

| Metric | Argus | Solo-Claude |
|---|---|---|
| Pass | 10 / 10 | 10 / 10 |
| Partial | 0 | 0 |
| Fail | 0 | 0 |
| Mean wall-time | 230.4 s | 33.5 s |
| Median wall-time | 182.3 s | 26.7 s |
| Fastest | 128.75 s (T03) | 15.93 s (T07) |
| Slowest | 460.26 s (T06) | 64.67 s (T01) |

### Argus-specific

- **First-grade-A rate:** 7 / 10
- **Reached-A within 2 iterations:** 8 / 10
- **Stuck at B after 2 iter:** task 02 (recipe card)
- **Stuck at C after 2 iter:** task 06 (md → json — correct Codex grade given the eval-protocol gap)
- **Mean iterations-to-completion:** 1.3
- **Wall-time gap vs solo:** ~6.88× mean / ~6.8× median

### Rubric divergences between pipelines

Zero. On these 10 tasks, Argus and solo-Claude produced rubric-equivalent outputs.

### Where Argus demonstrated a specific advantage

- **Task 06:** Codex's C correctly flagged that the end-to-end build was un-auditable (ENOENT) even though the parser itself was sound. This is the audit layer doing its intended job — honest failure detection. Solo-Claude has no equivalent fire-alarm.
- **Task 10:** Argus wrote one extra edge-case test (single-element input) beyond the rubric minimum. Bonus, not decisive.

### Where Argus demonstrated no advantage

- **Tasks 01, 03, 04, 05, 07, 08, 09:** Rubric-equivalent outputs, Argus 3.8× – 14× slower.
- **Task 02:** Argus went 2 iterations → B on a task solo passed in one shot. The second iteration did not rescue the grade, and Codex's B did not correspond to any rubric-level miss the rubric could identify.
- **Task 05:** Byte-identical outputs (including error message text) between Argus and solo, but Argus took 14× longer.

### Honest interpretation

**The hypothesis "orchestrated specialization beats any single model" is not supported on this 10-task baseline.** For tasks in the range we tested (small-to-medium greenfield builds, CLIs, data transforms, refactors, debug-with-test), Claude Sonnet 4.6 via `claude -p` matches the full three-agent pipeline output-for-output, at ~15% of the wall-time cost.

What the pipeline did demonstrably add:

1. **Graceful degradation on its own infrastructure gaps.** Task 06's C is a correct audit output for a broken build — Codex didn't paper over it. A solo-Claude invocation that produced the same parser code would not have self-flagged the ENOENT as a quality issue.
2. **Iteration capacity when it helps.** Task 05 took 2 iterations to hit A; the final output was sound. When the first iteration is B, the build loop sometimes pulls it to A. When the first iteration is B and the rubric is tight, the build loop may not rescue it (task 02).

What the pipeline did not demonstrably add on these tasks:

1. A better output than solo-Claude on any task, as graded against pre-specified rubrics.
2. A defense against trivial task decomposition. Solo-Claude handled every one of these tasks end-to-end without orchestration help.

### Caveats worth stating

1. **Task size is a confound.** These 10 tasks are individually small enough that solo-Claude can keep the whole problem in its head in a single turn. The thesis "orchestration beats solo" is most likely to hold (if it holds at all) on tasks where the plan/build/audit split spans reasoning horizons that don't fit in one shot. We did not test those.
2. **Model generation is a confound.** Claude Sonnet 4.6 (what `claude -p` defaults to today) is dramatically more capable than the models that likely motivated the three-agent design pattern 12–18 months ago. The thesis may have been true against 2024-era models and false against 2026-era ones. This eval does not distinguish those cases.
3. **Solo-Claude is itself a planner+builder+self-critic internally.** Claude's own training includes extended reasoning, tool use, and self-revision within a single turn. The "solo" baseline is less solo than the framing suggests. If we wanted to test "pure builder" we would have used `gemini -p` or a weaker model directly. We did not.
4. **Task mix is exploratory.** 3 web / 2 CLI / 2 data / 2 debug / 1 refactor is a defensible sample but not rigorous. A formal eval would stratify by difficulty, randomize order, and include at least 30 tasks per category for statistical power.

### Consequences for Argus's product story

The pitch "orchestrated specialization beats any single model" needs at least one of:
- A task category where solo-Claude demonstrably fails and Argus demonstrably succeeds, OR
- A workflow benefit (e.g. audit detecting a defect the user wouldn't have caught otherwise) that the user values beyond the wall-time cost.

On this baseline, neither is evidenced. The eval does not kill the thesis — it establishes that the thesis must either be scoped (to larger tasks, weaker models, or specific failure modes) or reframed (toward the audit-layer value rather than the output-quality value).

### Recommended next moves

1. **Don't ship a "try Argus" page based on these numbers.** The data doesn't support the product-page claims.
2. **Run a second eval with harder tasks.** Pick tasks that require multi-file coordination, long-running API design decisions, or adversarial inputs. This is where planner-then-builder separation is most likely to earn its keep.
3. **Run a second eval with weaker builder models.** Swap Gemini for a smaller model and see whether Argus's plan+audit scaffolding is what lets a weaker builder reach parity with solo-Sonnet-4.6.
4. **Quantify the audit-as-fire-alarm value.** Track over N real user tasks how often Codex's grade correctly flags a broken build that the user would have otherwise accepted. This is the least-measured and probably most-valuable signal.

