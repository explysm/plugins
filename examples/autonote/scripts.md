# Custom JavaScript Scripts

For power users, AutoNote allows running arbitrary JavaScript to manipulate your message content and perform actions before or after sending.

## Script Context
- `content` (string): The current message string.
- `note` (object): The profile object containing its settings.
- `utils` (object):
  - `send(text)`: Sends a new message to the current channel.
  - `delete(messageId)`: Deletes a message in the current channel.
  - `runAfter(callback)`: Registers a function to run **after** the current message has been successfully sent. The callback receives the `messageId` of the sent message.

## Example 1: Auto-Delete (Ninja Mode)
Send a message that automatically deletes itself after 5 seconds.
**Script:**
```javascript
utils.runAfter((id) => {
    setTimeout(() => {
        utils.delete(id);
    }, 5000);
});
return content;
```

## Example 2: Self-Log ID
Log the ID of the message you just sent.
**Script:**
```javascript
utils.runAfter((id) => {
    utils.send("The message ID was: " + id);
});
return content;
```

## Example 3: Upper Case All
**Script:**
```javascript
return content.toUpperCase();
```

## Example 4: Message Splitting
If you want to split a long message into multiple parts:
**Script:**
```javascript
if (content.length > 2000) {
    const part2 = content.slice(2000);
    utils.send(part2);
    return content.slice(0, 2000);
}
return content;
```
