# AutoNote Advanced API

These utilities allow you to perform more complex actions such as networking, logging, and data persistence.

### `utils.fetch(url, options)`
Standard fetch API to make HTTP requests.
- Returns a Promise.
- `options`: Standard fetch options (`method`, `headers`, `body`).

```javascript
return utils.fetch("https://api.quotable.io/random")
    .then(r => r.json())
    .then(data => content + "\n\n> " + data.content + " — " + data.author);
```

### `utils.webhook(url, payload)`
Sends data to a Discord webhook.
- `url`: The webhook URL.
- `payload`: An object that can contain `content`, `name` (username), `avatar` (avatar_url), and `embeds`.

```javascript
utils.webhook("https://discord.com/api/webhooks/...", {
    name: "AutoNote Logger",
    content: "A message was sent: " + content
});
```

### `utils.storage`
A persistent JavaScript object shared across all AutoNote profiles. You can use it to store and retrieve data between messages or even between different profiles.

```javascript
// Keep track of the total number of messages sent
storage.total = (storage.total || 0) + 1;
return content + "\n-# Total sent: " + storage.total;
```

### `utils.log(message)`
Pushes a log entry to the "Script Logs" section in the plugin settings. This is useful for debugging your scripts.

```javascript
utils.log("Current channel is: " + utils.channel);
```

### `utils.sleep(ms)`
Async function to pause execution for a specific duration. Must be used with `await`.

```javascript
await utils.sleep(2000); // Wait for 2 seconds
utils.send("Delayed message!");
```
