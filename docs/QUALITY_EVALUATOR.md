# AI Quality Evaluator

Deterministic quality gate for AI-generated Modul Ajar documents.

## Overview

The AI Quality Evaluator (`qeval`) is a scoring engine that ensures AI outputs meet curriculum and pedagogical standards before they are delivered to the user. It acts as a gatekeeper in the worker pipeline, triggering retries for mediocre content and failing non-compliant generation.

## Scoring Rubric (v1.0.0)

| Category | Weight | Description |
|----------|--------|-------------|
| **Completeness** | 25 | Presence of learning objectives, materials, and assessments. |
| **Pedagogical Clarity** | 20 | Meaningfulness and length of learning activities. |
| **Assessment Quality**| 20 | Non-generic assessment instructions. |
| **Curriculum Alignment**| 15 | Presence of Profil Pelajar Pancasila. |
| **Specificity & Style** | 20 | Detection of AI references, placeholders, and formatting. |

## Pipeline Behavior

Based on the score (0-100), the system determines a **Verdict**:

- **Pass (>= 80)**: Proceeds directly to PDF generation.
- **Pass with Warning (70-79)**: Proceeds but logs diagnostic flags.
- **Retry (60-69)**: Triggers AI regeneration (up to 2 retries).
- **Fail (< 60)**: Immediately fails the job with `quality_evaluation_failed`.

## Observability

### Metrics
- `quality_score_histogram`: Distribution of AI quality scores.
- `quality_pass_total`: Count of documents passing the gate.
- `quality_retry_total`: Count of regenerations triggered by quality.
- `quality_fail_total`: Count of jobs blocked by low quality.

### Diagnostic Flags
Common flags returned in metadata:
- `short_content`: Learning activities are too brief.
- `placeholder_text`: Found `[isi di sini]` or `Lorem Ipsum`.
- `style_ai_reference`: Found "As an AI language model...".
- `missing_assessment`: No assessment blocks found.

## Performance
- **Latency**: < 0.1ms (82us measured).
- **Complexity**: O(N) where N is text length (regex based).
