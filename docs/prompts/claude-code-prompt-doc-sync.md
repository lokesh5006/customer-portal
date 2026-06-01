# Claude Code Prompt — Commit All BA Documents to /docs/

Copy everything below this line into Claude Code in VS Code. Run on the project root (`cusotmerportal2`).

**Context:** All the business analyst (BA) documents — audit, risk register, discovery summary, client feedback, prompts, and user stories — currently live outside git. They need to be committed to the repo alongside the code so they survive long-term and live next to what they describe.

**Your job:** Create a `/docs/` folder structure, copy the documents into it, commit them on a new branch, push, and report back with a PR-create link.

---

## Step 1 — Find the source documents

The user will have saved all the documents into a folder on their machine. Common locations to check:

1. `C:\Users\lokes\Downloads` — most likely location
2. `C:\Users\lokes\OneDrive\Documents`
3. `C:\Users\lokes\Documents`

Look for these specific files (some may not be present — that's fine, skip what's missing):

- `Customer_Portal_Discovery_Summary_And_Recommendations.docx`
- `Customer_Portal_Pre_Reset_Audit.docx`
- `Customer_Portal_client_feedbacks*.docx` (may have variations in the filename)
- `v13_Risk_Register.docx`
- `claude-code-prompt-v13-discovery-recommendations.md`
- `claude-code-prompt-v13-resume.md`
- `claude-code-prompt-v14-final-prototype-reset.md`
- `claude-code-prompt-v15-client-feedback.md`
- Any files matching `US-SP*.docx` (user stories from previous sessions)
- Any files matching `BA_Analysis_*.docx`

If you can't find files in those locations, ask the user where they saved them.

---

## Step 2 — Create the /docs/ folder structure

In the repo root (`cusotmerportal2`), create this folder structure:

```
docs/
├── client-facing/
├── audits/
├── client-feedback/
├── prompts/
└── user-stories/
```

Use `mkdir` to create these folders if they don't exist.

---

## Step 3 — Copy files into the right folders

Copy (don't move — keep originals on the user's machine) the documents into these locations:

| File pattern | Destination |
|---|---|
| `Customer_Portal_Discovery_Summary_And_Recommendations.docx` | `docs/client-facing/` |
| `Customer_Portal_Pre_Reset_Audit.docx` | `docs/audits/` |
| `v13_Risk_Register.docx` | `docs/audits/` |
| `Customer_Portal_client_feedbacks*.docx` | `docs/client-feedback/` |
| `claude-code-prompt-*.md` | `docs/prompts/` |
| `US-SP*.docx` | `docs/user-stories/` |
| `BA_Analysis_*.docx` | `docs/user-stories/` |

---

## Step 4 — Create a README.md in /docs/

Create `docs/README.md` with this content (use whatever line endings the project uses):

```markdown
# Customer Portal — Documentation

This folder holds the business analyst documents that drove the design of this prototype. It is organized by purpose.

## Folders

### `client-facing/`
Documents shared with the client (Leimberg, LeClair & Lackner) for review. The discovery summary captures confirmed flows and 14 open questions with team recommendations.

### `audits/`
Internal audit documents driving major resets. The pre-reset audit captures the 9-round walkthrough that drove the v14 reset. The risk register maps each v13 client recommendation to its revert path if the client overrides during review.

### `client-feedback/`
Raw client feedback documents that drove specific iterations (e.g., v15 implemented user stories #1525–#1626 from `Customer_Portal_client_feedbacks.docx`).

### `prompts/`
The Claude Code prompts that produced each major version. Reading these is the fastest way to understand what changed and why between v13, v14, and v15. Each prompt was the input to Claude Code; the resulting commits are in git history.

### `user-stories/`
Stakeholder-ready user stories in standard SP07/SP08/SP09 format. Each story captures requirements, acceptance criteria, references, and any noted deviations.

## Versioning

The customer portal evolved through 15 numbered iterations (v1–v15). The final demo-ready prototype is built from v14 (final prototype reset) and v15 (client feedback). Earlier iterations (v1–v13) exist in git history.
```

---

## Step 5 — Commit and push

```bash
git checkout -b add-ba-documentation
git add docs/
git commit -m "Add BA documentation: audits, prompts, user stories, client-facing docs"
git push -u origin add-ba-documentation
```

---

## Step 6 — Report back

When done, report:

1. The full list of files copied, organized by folder.
2. The commit SHA.
3. The PR-create link: `https://github.com/lokesh5006/cusotmerportal2/pull/new/add-ba-documentation`

If any expected files were not found, list those too. The user will provide them or confirm they should be skipped.

Do NOT merge the branch. The user will open the PR via the link.
