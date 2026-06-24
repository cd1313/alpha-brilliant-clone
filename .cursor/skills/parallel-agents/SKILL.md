---
name: parallel-agents
description: >-
  Run multiple Cursor subagents in parallel by looping over a list of tasks and
  launching one background subagent per item, then collecting and synthesizing
  their results. Use when the user wants to fan out work across parallel agents,
  process many independent items at once, batch tasks with subagents, or speed up
  multi-item work.
disable-model-invocation: true
---

# Parallel Agents (Fan-Out)

Fan out independent work by launching one subagent per task in parallel, then
combine the results.

## When to use
- Several **independent** tasks (e.g., audit 6 packages, summarize 10 files, investigate 4 areas at once).
- Each task is substantial enough to justify its own subagent.

## When NOT to use
- A single task, or tasks that depend on each other's output — do those sequentially.
- Trivial work you can finish directly with a couple of tool calls.

## Workflow

Copy this checklist and track progress:

```
- [ ] 1. List the items/tasks to fan out
- [ ] 2. Write a self-contained prompt per item
- [ ] 3. Launch all subagents in ONE message (parallel)
- [ ] 4. Wait for completion
- [ ] 5. Collect each result
- [ ] 6. Synthesize the final answer
```

### 1. List the tasks
Enumerate the independent units of work. Keep each batch small (about 3-8); for longer lists, run in batches and start the next batch as earlier ones finish.

### 2. Write a self-contained prompt per item
Each subagent starts fresh and does NOT see this conversation. Every prompt must include:
- The full context it needs (repo path, file paths, constraints, prior decisions).
- The single task for that item.
- The exact result format to return, so results merge cleanly.

### 3. Launch all subagents in one message
Put **multiple Task tool calls in a single message** so they run concurrently. For each call:
- `run_in_background: true` to keep working while they run (you get a completion notification per agent); required in Multitask Mode.
- `subagent_type`: `explore` (read-only investigation), `generalPurpose` (multi-step work or edits), `shell` (commands).
- `readonly: true` for investigation-only agents.
- A short, distinct `description`.

### 4. Wait for completion
Background agents notify you when they finish — do not poll or AwaitShell them. If you are blocked on their results, await; otherwise keep doing other work and handle results as notifications arrive.

### 5. Collect results
Each subagent returns a single final message in the format you requested in its prompt.

### 6. Synthesize
Merge the per-agent results into one de-duplicated answer. Resolve conflicts and explicitly call out anything an agent could not complete.

## Prompt template

One Task call per item, all in the same message:

```
Task(
  description: "<3-5 word title>",
  subagent_type: "explore" | "generalPurpose" | "shell",
  run_in_background: true,
  readonly: <true for investigation-only>,
  prompt: """
  Context: <everything the agent needs; it cannot see the main chat>
  Task: <the single item to handle>
  Return: <exact format of the result to report back>
  """
)
```

## Example

Goal: review four modules for security issues, in parallel.

1. Items: `auth/`, `api/`, `db/`, `payments/`.
2. In one message, launch four `explore` subagents, each `readonly: true` and `run_in_background: true`, with a prompt like:
   "Context: repo at <path>; review only the `auth/` module. Task: find security issues (authz, input validation, secret handling). Return: a bullet list as `severity - file:line - issue`, or 'none found'."
3. When all four report back, merge findings into one list grouped by severity.

## Tips
- Subagents are isolated: over-specify context rather than assume shared knowledge.
- To run the **same** task several ways and keep the best, use the `best-of-n-runner` subagent instead (isolated git worktrees).
- To send a follow-up to a finished agent, resume it by its agent id.
- This skill loads only when named. To let the agent auto-apply it from context, remove `disable-model-invocation: true` from the frontmatter.
```
