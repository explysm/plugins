# Basic Silent Note

This is the most common use case for AutoNote. It adds a small note to messages that start with `@silent` to explain that the message was sent silently on purpose.

## Configuration

- **Trigger:** `@silent`
- **Position:** `BOTTOM`
- **Style:** `SUBTEXT` (-#)
- **Remove trigger:** `False`
- **Note Text:** `This was sent as a @silent message to avoid annoyance`

## Result

### Input
`@silent hey, i'm busy right now`

### Output
`@silent hey, i'm busy right now`
`-# This was sent as a @silent message to avoid annoyance`
