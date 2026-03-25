# Custom JavaScript Scripts

AutoNote allows running arbitrary JavaScript to manipulate message content and perform actions before or after sending.

## Script Context
- `content` (string): The current message string.
- `note` (object): The profile object containing its settings.
- `storage` (object): A persistent data object unique to this profile. Data saved here persists between messages.
- `utils` (object):
  - `send(text)`: Sends a new message to the current channel.
  - `delete(messageId)`: Deletes a message in the current channel.
  - `edit(messageId, text)`: Edits a message in the current channel.
  - `copy(text)`: Copies text to the system clipboard.
  - `fetch(url, options)`: Standard `fetch` API for network requests. Returns a Promise.
  - `runAfter(callback)`: Registers a function to run **after** the message is sent. Receives the `messageId`.

---

## Examples

### 1. Simple Message Filter (Cancellation)
Stop yourself from sending a message if it's too short. Returning `null` cancels the send.
**Script:**
```javascript
if (content.length < 5) {
    return null;
}
return content;
```

### 2. Message Counter (Persistence)
Uses the `storage` object to remember how many messages you've sent with this trigger.
**Script:**
```javascript
storage.count = (storage.count || 0) + 1;
return content + `\n-# Total messages sent with this trigger: ${storage.count}`;
```

### 3. "Ninja" Mode (Auto-Delete)
Sends a message that automatically deletes itself after 5 seconds.
**Script:**
```javascript
utils.runAfter((id) => {
    setTimeout(() => {
        utils.delete(id);
    }, 5000);
});
return content;
```

### 4. Copy Message ID to Clipboard
Automatically copies the ID of every message you send to your clipboard.
**Script:**
```javascript
utils.runAfter((id) => {
    utils.copy(id);
});
return content;
```

### 5. Message Splitting
Automatically splits long messages (>2000 chars) into two separate messages.
**Script:**
```javascript
if (content.length > 2000) {
    const part2 = content.slice(2000);
    utils.send(part2);
    return content.slice(0, 2000);
}
return content;
```

### 6. Fetch Random Quote from API
Uses `utils.fetch` to retrieve data from an external API and append it to your message.
**Script:**
```javascript
const quote = await utils.fetch("https://api.quotable.io/random")
    .then(r => r.json());

return content + `\n\n> ${quote.content} — ${quote.author}`;
```
