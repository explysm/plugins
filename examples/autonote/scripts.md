# Custom JavaScript Scripts

For power users, AutoNote allows running arbitrary JavaScript to manipulate your message content.

## Script Context
- `content` (string): The current message string.
- `note` (object): The profile object containing its settings.

## Example 1: Upper Case All
**Script:**
```javascript
return content.toUpperCase();
```
**Result:** Any message starting with the trigger will be converted to ALL CAPS.

## Example 2: Add Word Count
**Script:**
```javascript
const words = content.split(' ').length;
return content + `\n-# Word count: ${words}`;
```
**Result:** Appends a subtext line with the word count of your message.

## Example 3: Conditional Footers
**Script:**
```javascript
if (content.length > 100) {
    return content + "\n-# This was a long message.";
}
return content;
```
**Result:** Only adds the footer if the message is longer than 100 characters.
