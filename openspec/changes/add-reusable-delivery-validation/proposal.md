## Why

AgentHub can record successful runs and check command evidence, but a deliverable can still violate the user's requirements after an Agent's self-check passes. E2 produced valid JSON with correct source values in the wrong shape, then validated that shape with a script written by the producer. Users need a separate validator they can keep and run again.

## What Changes

- Add an opt-in conversation workflow for selecting source requirements and workspace delivery files, generating a validator with a dedicated Custom child Agent, reviewing its draft, and explicitly using a saved revision.
- Let the child propose declarative checks and bounded pure validation functions over named snapshots. The framework qualifies and interprets them, and renders a readable function for review.
- Persist immutable plan revisions and separate validation receipts in the existing embedded SQLite database. Keep prior revisions available in their conversation, with explicit selection for reuse.
- Validate the current file snapshot at explicit submission or review. Report rule-level pass, fail, or unverified with source, file version, and error location.
- Keep validation artifacts, run completion, and benchmark scoring as distinct records. The rollout uses fake model transport and synthetic fixtures for acceptance checks.

## Capabilities

### New Capabilities

- `delivery-validation`: Generate, qualify, version, reuse and execute bounded delivery validation rules and pure functions against actual workspace files.

### Modified Capabilities

None. Existing ordinary conversation, dispatch and tool flows retain their current defaults. The new capability owns the additive opt-in entry, storage, child purpose and result contract.

## Impact

The capability touches AgentRunner and Custom input isolation, a server-side validation service, local SQLite bootstrap and schema, and a small conversation entry for generation, review and validation. It uses the project's existing Zod, Drizzle and filesystem boundaries. The execution engine interprets rule data and requires no separate runtime or dependency.
