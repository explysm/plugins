// Profanity Counter (No-Delay Version)
// Triggers in DMs if score > 0.980 & no links
if (utils.channelType === 0 && !content.includes("https://")) {
  
  // Register the task to run AFTER the message is sent
  utils.runAfter(id => {
    // Start the API check in the background
    utils.fetch("https://vector.profanity.dev", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: content })
    })
    .then(r => r.json())
    .then(res => {
      if (res.isProfanity && res.score > 0.980) {
        // Increment global counter
        utils.storage.badWords = (utils.storage.badWords || 0) + 1;

        // Edit the message that was already sent
        utils.edit(id, content + "\n-# Swear count: " + utils.storage.badWords);
        
        // Optional: show a toast to let you know it worked
        utils.toast("Counter updated!");
      }
    });
  });
}

// Return the content IMMEDIATELY so there is zero lag
return content;
