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
  - `log(...args)`: Logs messages to the developer console.
  - `sleep(ms)`: A helper for pausing execution (e.g., `await utils.sleep(1000)`).
  - `stop()`: A helper that returns `null` to cancel sending the message.
  - `webhook(url, data)`: Sends a message to a Discord webhook (bypasses browser CORS blocks).
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
return utils.fetch("https://api.quotable.io/random")
    .then(r => r.json())
    .then(quote => {
        return content + `\n\n> ${quote.content} — ${quote.author}`;
    });
```

### 7. Webhook Logger
Forwards a copy of every message sent with this trigger to an external Discord webhook.
**Script:**
```javascript
utils.webhook("WEBHOOK_URL", {
    name: "AutoNote Log Bot",
    content: `[#${utils.channel}] Message Sent: ${content}`
});
return content;
```

### 8. Multi-Bot Identity (Cancellation)
Instead of sending a regular message, send a webhook as a different bot and cancel the original.
**Script:**
```javascript
const bots = [
    { name: "Support Bot", icon: "https://i.imgur.com/8fK0X9f.png" },
    { name: "Emergency Bot", icon: "https://i.imgur.com/R67pXS0.png" }
];
const bot = bots[Math.floor(Math.random() * bots.length)];

utils.webhook("WEBHOOK_URL", {
    name: bot.name,
    avatar: bot.icon,
    content: content
});
return null; // Cancel the original message
```

### 9. Stats Reporter (Memory + Webhook)
Uses persistent memory to track message counts and report to a webhook every 10 messages.
**Script:**
```javascript
storage.count = (storage.count || 0) + 1;

if (storage.count % 10 === 0) {
    utils.webhook("WEBHOOK_URL", {
        name: "Stats Reporter",
        content: `User has sent ${storage.count} messages using this trigger.`
    });
}
return content;
```

