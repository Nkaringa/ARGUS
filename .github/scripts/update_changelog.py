import os
import re

PR_NUMBER = os.environ["PR_NUMBER"]
PR_TITLE = os.environ["PR_TITLE"]
PR_URL = os.environ["PR_URL"]
PR_AUTHOR = os.environ["PR_AUTHOR"]
PR_LABELS = os.environ.get("PR_LABELS", "")

LABEL_MAP = {
    "added": "Added",
    "feature": "Added",
    "enhancement": "Added",
    "changed": "Changed",
    "refactor": "Changed",
    "deprecated": "Deprecated",
    "removed": "Removed",
    "fixed": "Fixed",
    "bug": "Fixed",
    "bugfix": "Fixed",
    "security": "Security",
}

labels = [l.strip().lower() for l in PR_LABELS.split(",") if l.strip()]
category = "Changed"
for label in labels:
    if label in LABEL_MAP:
        category = LABEL_MAP[label]
        break

new_entry = f"- {PR_TITLE} ([#{PR_NUMBER}]({PR_URL})) — @{PR_AUTHOR}"

UNRELEASED_HEADER = "## [Unreleased]"

with open("CHANGELOG.md", "r") as f:
    content = f.read()

if UNRELEASED_HEADER not in content:
    match = re.search(r"^## \[\d", content, re.MULTILINE)
    if match:
        pos = match.start()
        content = (
            content[:pos]
            + f"{UNRELEASED_HEADER}\n\n### {category}\n{new_entry}\n\n---\n\n"
            + content[pos:]
        )
    else:
        content += f"\n{UNRELEASED_HEADER}\n\n### {category}\n{new_entry}\n"
else:
    unreleased_start = content.index(UNRELEASED_HEADER)
    after_header = unreleased_start + len(UNRELEASED_HEADER)

    next_section = re.search(r"^## ", content[after_header:], re.MULTILINE)
    unreleased_end = after_header + next_section.start() if next_section else len(content)

    unreleased_body = content[after_header:unreleased_end]
    category_header = f"### {category}"

    if category_header in unreleased_body:
        cat_pos = unreleased_body.index(category_header)
        after_cat = cat_pos + len(category_header)
        next_cat = re.search(r"^### ", unreleased_body[after_cat:], re.MULTILINE)
        if next_cat:
            insert_at = after_header + after_cat + next_cat.start()
            content = content[:insert_at] + new_entry + "\n" + content[insert_at:]
        else:
            insert_at = unreleased_end
            content = content[:insert_at].rstrip("\n") + "\n" + new_entry + "\n" + content[insert_at:]
    else:
        insert_at = unreleased_end
        content = (
            content[:insert_at].rstrip("\n")
            + f"\n\n{category_header}\n{new_entry}\n"
            + content[insert_at:]
        )

with open("CHANGELOG.md", "w") as f:
    f.write(content)

print(f"Added [{category}] entry for PR #{PR_NUMBER}: {PR_TITLE}")
