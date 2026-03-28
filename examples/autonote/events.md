# AutoNote Events API

AutoNote allows you to trigger actions based on both outgoing and incoming messages.

### `utils.onMessage(query, mode, callback)`
Registers a global listener for the current script's execution context.
- `query`: The text to search for.
- `mode`: `"contains"`, `"startswith"`, `"match"`, or `"regex"`.
- `callback`: A function `(message) => {}` that runs when a match is found. The `message` object includes `id`, `content`, `author`, and `channelId`.

This utility allows your script to react to other users' messages if the script is active in that channel.

```javascript
// Auto-react with a fire emoji when someone mentions "aura"
utils.onMessage("aura", "contains", (msg) => {
    utils.react(msg.id, "🔥");
});
```

### `utils.runAfter(callback)`
Registers a callback that executes **after** the current message is successfully sent to Discord.
- `callback`: A function `(id) => {}` that receives the newly sent message ID.

This is primarily used for self-destructive messages or performing actions that require the message's own ID.

```javascript
// Auto-delete the message after 5 seconds
utils.runAfter(id => {
    setTimeout(() => {
        utils.delete(id);
    }, 5000);
});
return content; // Send the message normally
```
