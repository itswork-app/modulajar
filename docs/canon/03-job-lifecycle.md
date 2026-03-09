# Job Lifecycle Contract — Canon 03

The Generation Job lifecycle is formalized as a strict state machine to prevent contract drift and ensure consistent job handling across the API and workers.

## State Machine Diagram

```mermaid
state_diagram
    [*] --> queued : api-ts (POST /generate)
    queued --> running : worker-go (Acquire)
    running --> done : worker-go (Success)
    running --> failed : worker-go (Max Retries)
    running --> queued : worker-go (Retry/Backoff)
```

## Transition Rules

| From | To | Trigger | Layer |
| :--- | :--- | :--- | :--- |
| `(none)` | `queued` | Job enqueued | `api-ts` |
| `queued` | `running` | Job acquired | `worker-go` |
| `running` | `done` | Generation success | `worker-go` |
| `running` | `failed` | Terminal failure | `worker-go` |
| `running` | `queued` | Transient failure | `worker-go` |

### Invariants
1. **Validation**: Any state transition not defined in the table above is rejected by the `ValidateTransition` guard in `core-go/db`.
2. **Persistence**: `MarkJobDone` is only called after all output artifacts (PDFs) are successfully persisted to object storage.
3. **Backoff**: Retries (`running` → `queued`) follow an exponential backoff schedule ($5 \times 2^{(n-1)}$ seconds).

## Observability

### Metrics
The following metrics are exposed by the Go worker:

- `job_started_total`: Total number of jobs that transitioned to `running`.
- `job_completed_total`: Total number of jobs that transitioned to `done`.
- `job_failed_total`: Total number of terminal failures (transitioned to `failed`).

### Structured Logs
State transitions emit standardized JSON logs:
- `Job acquired`: Transition to `running`.
- `Job done successfully`: Transition to `done`.
- `Job terminal failure`: Transition to `failed`.
- `Job failed`: Transition to `queued` (retry).
