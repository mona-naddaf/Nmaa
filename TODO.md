# TODO

## Supervisor attribution row can be claimed by a teacher login (next, after the calendar)

`resolveTeacherId` (src/lib/auth/teacher-identity.ts) attributes supervisor
actions to a synthetic per-course Teacher row found by `nameKey = "مديرة الدورة"`.
Teacher login (`teacherLoginAction` in src/app/login/actions.ts) upserts a
Teacher by name + course code only, so a teacher who logs in with the name
"مديرة الدورة" gets a session on that same row. Her recitation sessions,
points, attendance and flagged mistakes are then indistinguishable from the
supervisor's, and she'd be recorded as the author of past supervisor entries.

The calendar avoids this by storing `createdByTeacherId = null` for supervisor
events instead of using the synthetic row.

Fix ideas: reserve the name at login, and/or mark the synthetic row with a
flag (e.g. `isSupervisorProxy`) and look it up by that instead of by name.
