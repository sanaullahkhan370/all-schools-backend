# Academic Foundation

This build adds Admin APIs for academic sessions, terms, classes, sections,
subjects and primary-teacher assignments.

## API base

All endpoints require an Admin JWT:

`Authorization: Bearer <token>`

Base path: `/api/admin/academic`

## Endpoints

- `GET|POST /sessions`
- `PATCH /sessions/:id`
- `PATCH /sessions/:id/current`
- `GET|POST /terms`
- `GET|POST /classes`
- `GET|POST /sections`
- `GET|POST /subjects`
- `GET|POST /teacher-assignments`
- `PATCH /teacher-assignments/:id/deactivate`

Create academic data through the Admin APIs. Legacy demo seed files have been removed.
