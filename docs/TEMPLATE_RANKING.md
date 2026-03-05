# Template Ranking Engine

The Template Ranking Engine is a core component of the Modul Ajar generation pipeline. It selects the most relevant high-quality templates from the project dataset to be used as few-shot examples for the AI, significantly improving output stability and pedagogical alignment.

## Architecture

The ranking process follows a deterministic pipeline:

1.  **Filtering**: Candidates are filtered by `subject` and `grade` to ensure structural compatibility.
2.  **Scoring**: Each candidate is scored based on three primary signals:
    *   **Quality Score (60%)**: The deterministic score from the `qeval` package.
    *   **Usage Count (20%)**: Popularity signal based on successful teacher refinements.
    *   **Topic Similarity (20%)**: Jaccard similarity between the current request topic and the candidate's topic.
3.  **Selection**: The top 3 candidates are selected and injected into the AI prompt.

## Ranking Formula

```text
Score = (QualityScore * 0.6) + (UsageScore * 0.2) + (SimilarityScore * 0.2)
```

Where:
- `UsageScore` is normalized (currently `min(UsageCount * 0.1, 1.0)`).
- `SimilarityScore` is the Jaccard similarity coefficient (0.0 to 1.0).

## Implementation Details

- **Package**: `apps/core-go/curriculum/ranking`
- **Logic**:
    - `similarity.go`: Tokenization and Jaccard intersection calculation.
    - `score.go`: Weighted ranking formula.
    - `selector.go`: Orchestration and top-N selection.
    - `engine.go`: Database abstraction and candidate retrieval.

## Observability

- **Metrics**:
    - `template_rank_requests_total`: Total ranking requests.
    - `template_rank_latency_ms`: Distribution of ranking latency.
    - `template_selected_total`: Counter of how many templates were successfully injected (0-3).
- **Logs**:
    - Structured logs include `subject`, `grade`, `topic`, and the IDs of selected templates.

## Performance

- **Target**: < 20ms
- **Actual**: ~0.15ms (for 100 candidates)
