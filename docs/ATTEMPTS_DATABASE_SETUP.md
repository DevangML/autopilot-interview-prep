# Attempts Tracking (Local DB)

Attempts are stored in the local SQLite database automatically. No Notion attempts database is required.

## Where Attempts Live

Table: `attempts`

Key fields:
- `item_id`
- `result`
- `confidence`
- `time_spent_min`
- `mistake_tags`
- `hint_used`
- `created_at`

These rows are created automatically when a work unit is completed.
