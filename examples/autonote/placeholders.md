# Dynamic Placeholders

AutoNote supports dynamic placeholders that are replaced with live information when you send a message.

## Placeholders
- `{trigger}`: The keyword that triggered the note.
- `{time}`: The current time (local).
- `{date}`: The current date (local).

## Example Configuration

- **Trigger:** `!auto`
- **Position:** `BOTTOM`
- **Style:** `BLOCKQUOTE` (>)
- **Remove trigger:** `True`
- **Note Text:** `Automated message triggered by {trigger} at {time}`

## Result

### Input
`!auto Here is the data you requested.`

### Output
`Here is the data you requested.`
`> Automated message triggered by !auto at 14:30:05`
