## Why

The current panel can generate, save and execute delivery validators, but normal Agent completion never calls that service. The user expects the Hub to perform acceptance automatically when a task hands over its deliverables.

## What Changes

- Bind a saved eligible revision to a single-Agent formal delivery when sending the request.
- Run the existing deterministic validator once at the producer's completion boundary and show the result in the conversation.
- Persist the run's delivery outcome and link it to the file snapshot receipt. The panel remains useful for viewing, maintaining and manually checking rule versions.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `delivery-validation`: Explicit task binding and automatic acceptance on a bound single-Agent run.

## Impact

Conversation send and regenerate, AgentRunner finalization, run status views, and the existing delivery validation and SQLite services. The new path reuses saved rules with zero added model calls. First delivery scope is a single-Agent run explicitly marked for handoff. Dispatch acceptance is a separate extension to the existing DAG dependency gate.
