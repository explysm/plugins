# AutoNote Scripting Documentation

AutoNote scripts allow you to intercept and modify your messages using JavaScript.

## Script Context

Every script has access to the following variables:

| Variable | Description |
| :--- | :--- |
| `content` | The current text of the message. |
| `note` | The current AutoNote profile object. |
| `storage` | A persistent object for the current profile to save data across messages. |
| `utils` | A collection of helper functions and metadata. |

## Utils API

### Metadata
- `utils.channelType`: Returns `0` for Direct Messages/Group DMs, and `1` for Guild channels.
- `utils.channel`: The name of the current channel.
- `utils.channelID`: The ID of the current channel.
- `utils.server`: The name of the current server (or "DMs").
- `utils.serverID`: The ID of the current server.
- `utils.user`: The current user object (contains `id`, `username`, etc).

### Functions
- `utils.content(text)`: Directly sets the final content of the message.
- `utils.send(text)`: Sends a new message in the current channel.
- `utils.delete(id)`: Deletes a message by its ID.
- `utils.edit(id, text)`: Edits a message by its ID.
- `utils.copy(text)`: Copies text to the clipboard.
- `utils.fetch(url, opts?)`: Standard fetch API for network requests.
- `utils.log(msg)`: Pushes a message to the "Script Logs" in settings.
- `utils.sleep(ms)`: Async sleep function (use with `await`).
- `utils.runAfter(callback)`: Runs a function after the message is successfully sent. The callback receives the message `id`.
- `utils.webhook(url, data)`: Sends a payload to a Discord webhook.

---

## Examples

### Channel-Specific Logic
Check if you are in a DM before performing an action.

```javascript
if (utils.channelType === 0) {
    utils.log("Running DM-only script");
    return content + "\n\n(This was sent in a DM)";
}
return content;
```

### Profanity Counter with `utils.fetch`
Checks for profanity using an external API and maintains a global counter across all scripts.

```javascript
// Checks for profanity using vector.profanity.dev
return utils.fetch("https://vector.profanity.dev", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: content })
}).then(r => r.json()).then(res => {
    if (res.isProfane) {
        // Increment a counter shared across all your scripts
        utils.storage.badWords = (utils.storage.badWords || 0) + 1;
        
        // Show a quick notification
        utils.toast("Profanity detected! Total: " + utils.storage.badWords);
        
        // Append the counter to the message
        return content + "\n-# ⚠️ Swear count: " + utils.storage.badWords;
    }
    return content;
});
```

### Auto-Delete after 5 Seconds
Use `utils.runAfter` to handle actions that require the message ID.

```javascript
utils.runAfter(id => {
    setTimeout(() => {
        utils.delete(id);
    }, 5000);
});
return content;
```
