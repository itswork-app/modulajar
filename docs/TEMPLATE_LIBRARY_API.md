# Template Library API

The Template Library API exposes ranked curriculum templates from the dataset for the UI wizard and module creation flow.

## Endpoint

```
GET /w/:workspaceId/templates/recommended
```

**Authentication**: Required (Clerk JWT + workspace membership)

## Query Parameters

| Parameter | Required | Type   | Description                    |
|-----------|----------|--------|--------------------------------|
| `subject` | Yes      | string | Subject name (e.g. "matematika") |
| `grade`   | Yes      | int    | Grade level (1–12)             |
| `topic`   | No       | string | Specific topic for similarity matching |

## Example Request

```
GET /w/ws_001/templates/recommended?subject=matematika&grade=4&topic=pecahan
```

## Response

```json
{
  "templates": [
    {
      "id": "uuid",
      "subject": "matematika",
      "grade": 4,
      "topic": "pecahan",
      "score": 92,
      "preview": {
        "tujuan_pembelajaran": "Siswa dapat membandingkan...",
        "ringkasan_kegiatan": "Eksplorasi dengan benda...",
        "assessment_summary": "Tes tertulis dan praktik..."
      }
    }
  ]
}
```

## Security Rules

- `module_json` is **never** exposed
- Internal dataset metadata is **never** exposed
- Preview fields are truncated to max 200 characters
- Rate limited: 60 requests/minute per IP

## Ranking Formula

Templates are ranked using:

```
score = (quality × 0.6) + (usage × 0.2) + (similarity × 0.2)
```

Top 3 results are returned.

## Error Responses

| Status | Condition                |
|--------|--------------------------|
| 400    | Missing/invalid params   |
| 401    | Unauthenticated          |
| 403    | Not workspace member     |
| 429    | Rate limit exceeded      |
| 500    | Internal error           |

## Empty Dataset

When no templates match, an empty array is returned:

```json
{ "templates": [] }
```

The UI should fallback to standard AI generation.

## UI Usage

The wizard calls this endpoint when the user selects a subject and grade:

```
UI wizard → GET /templates/recommended → show ranked templates → user picks → generate modul
```
