# AutoNote Messaging API

These utilities allow you to interact with messages in the current channel.

### `utils.send(text)`
Sends a new message to the current channel. This message will **not** be processed by AutoNote again to avoid infinite loops.

```javascript
utils.send("This is a separate message!");
```

### `utils.delete(id)`
Deletes a message in the current channel by its ID.

```javascript
utils.delete("1234567890");
```

### `utils.edit(id, text)`
Edits one of your existing messages in the current channel.

```javascript
utils.edit("1234567890", "This message has been edited by a script!");
```

### `utils.react(id, emoji)`
Adds a reaction to a message.
- `id`: The message ID to react to.
- `emoji`: The emoji name (e.g., `"🔥"`) or a custom emoji string (`"name:id"`).

```javascript
// React with a standard emoji
utils.react(id, "✅");

// React with a custom emoji
utils.react("1234567890", "blob_heart:1029384756");
```

### `utils.read(count)`
Returns an array of the last `count` messages in the current channel.
Each message object contains: `id`, `content`, `author`, `timestamp`, and `reactions`.

```javascript
const history = utils.read(5);
history.forEach(msg => {
    utils.log(`${msg.author.username}: ${msg.content}`);
});
```

### `utils.copy(text)`
Copies the provided text to your device's clipboard.

```javascript
utils.copy("Text to be copied");
```
