# Onboarding Flow

The onboarding wizard guides first-time teachers through profiling and leads them to their first module generation.

## Flow

```
signup → profil guru → profil sekolah → kelas & mapel → generate modul pertama
```

## Steps

| Step | Page | Description |
|------|------|-------------|
| 1 | `/onboarding/profile` | Teacher name + NIP |
| 2 | `/onboarding/school` | School name + location |
| 3 | `/onboarding/assignment` | Subject + grade |
| 4 | `/onboarding/start` | View templates + generate first module |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/w/:id/onboarding/profile` | Save teacher profile |
| `POST` | `/w/:id/onboarding/assignment` | Save teaching assignment |
| `GET` | `/w/:id/onboarding/status` | Check onboarding completion |

## Workspace Rule

- 1 teacher = 1 default workspace (auto-created at signup)
- Workspace name defaults to school name after onboarding

## Redirect Logic

If `onboarding_completed = false`, redirect to `/onboarding/profile`.

## Database

- `teachers` table: profile + school info + onboarding flag
- `teaching_assignments` table: subject + grade per teacher

## Metrics

- `onboarding_started_total` — profile step completed
- `onboarding_completed_total` — assignment step completed
