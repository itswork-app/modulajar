# Production Safety Hardening

## Overview

This document covers the production safety observability layer for the Modulajar worker. It provides heartbeat monitoring, stuck job detection, and alert-ready Prometheus metrics.

## Metrics Reference

| Metric | Type | Description |
|---|---|---|
| `worker_heartbeat_timestamp` | Gauge | Unix timestamp of last heartbeat (updated every 10s) |
| `jobs_stuck_gauge` | Gauge | Count of jobs running > 5 minutes (threshold configurable) |
| `jobs_queued_gauge` | Gauge | Current queued job count |
| `jobs_running_gauge` | Gauge | Current running job count |
| `jobs_failed_gauge` | Gauge | Current failed job count |
| `jobs_acquired_total` | Counter | Total jobs acquired by worker |
| `job_duration_ms` | Histogram | Job execution duration in ms |
| `job_retries_total` | Counter | Total retries triggered |
| `job_failures_total` | Counter | Total permanent failures |

## Stuck Job Detection

A job is considered **stuck** when:
- `status = 'running'`
- `locked_at IS NOT NULL`
- `locked_at < NOW() - 5 minutes`

Default threshold: **300 seconds** (configurable via `DefaultStuckThresholdSeconds`).

## Prometheus Alert Rules

```yaml
# Worker heartbeat stale (no update > 60s)
- alert: WorkerHeartbeatStale
  expr: time() - worker_heartbeat_timestamp > 60
  for: 1m
  labels:
    severity: warning
  annotations:
    summary: "Worker heartbeat is stale"

# Stuck jobs detected
- alert: JobsStuck
  expr: jobs_stuck_gauge > 0
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "{{ $value }} jobs stuck in running state"

# Queue backlog high
- alert: QueueBacklogHigh
  expr: jobs_queued_gauge > 20
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "Queue backlog: {{ $value }} jobs waiting"

# Failed jobs spike
- alert: FailedJobsSpike
  expr: increase(job_failures_total[10m]) > 5
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Failed jobs spiking: {{ $value }} in 10m"
```

## Architecture

The heartbeat loop runs as a goroutine inside the worker process, updating `worker_heartbeat_timestamp` and `jobs_stuck_gauge` every 10 seconds. Queue gauges are scraped on-demand by Prometheus via the `QueueCollector`.
