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
