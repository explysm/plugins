import { findByProps } from "@vendetta/metro";
import { React, ReactNative } from "@vendetta/metro/common";
import { after, before, instead } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";

const { ScrollView, Text, TouchableOpacity, StyleSheet, View } = ReactNative;

// Find internal modules
const MessageActions = findByProps("sendMessage", "receiveMessage");
const Clipboard = findByProps("setString", "getString");
const ChannelStore = findByProps("getChannel", "getChannels");
const GuildStore = findByProps("getGuild", "getGuilds");
const UserStore = findByProps("getCurrentUser", "getUser");
const HTTP = findByProps("get", "post", "put");

// UI Components
const TableRowGroup = findByProps("TableRowGroup")?.TableRowGroup;
const TableRow = findByProps("TableRow")?.TableRow;
const TableSwitchRow = findByProps("TableSwitchRow")?.TableSwitchRow;
const Stack = findByProps("Stack")?.Stack;
const TextInput = findByProps("TextInput")?.TextInput;

type NoteStyle = "none" | "subtext" | "blockquote" | "code";
type NotePosition = "top" | "bottom";

interface AutoNote {
  id: string;
  enabled: boolean;
  trigger: string;
  footer: string;
  removeTrigger: boolean;
  style: NoteStyle;
  position: NotePosition;
  script?: string;
  data?: Record<string, any>;
  isRegex?: boolean;
  icon?: string;
  whitelist?: string; // Comma-separated IDs
  blacklist?: string; // Comma-separated IDs
}

const TEMPLATES: Record<string, string> = {
  "Auto-Splitter": `// Splits long messages into multiple parts
const MAX_LENGTH = 2000;
if (content.length <= MAX_LENGTH) return content;
const parts = [];
let remaining = content;
while (remaining.length > 0) {
    parts.push(remaining.slice(0, MAX_LENGTH));
    remaining = remaining.slice(MAX_LENGTH);
}
parts.forEach(p => utils.send(p));
return null; // Cancel original`,
  "Ninja Mode": `// Deletes message after 5 seconds
utils.runAfter(id => {
    setTimeout(() => utils.delete(id), 5000);
});
return content;`,
  "Chaos Mode": `// Randomly swaps letters
return content.split("").map(c => Math.random() > 0.8 ? c.toUpperCase() : c.toLowerCase()).join("");`,
  "API Example": `// Fetch data from an API
return utils.fetch("https://api.quotable.io/random")
    .then(r => r.json())
    .then(data => content + "\\n\\n> " + data.content + " — " + data.author);`,
  "Webhook: Logger": `// Logs every message you send to a webhook
utils.webhook("WEBHOOK_URL", {
    name: utils.user.username + " Logger",
    content: "Sent in #" + utils.channel + ": " + content
});
return content;`,
  "Webhook: Multi-Bot": `// Randomizes the bot name/avatar for each message
const bots = [
    { name: "Guard", icon: "https://i.imgur.com/8fK0X9f.png" },
    { name: "Medic", icon: "https://i.imgur.com/R67pXS0.png" }
];
const bot = bots[Math.floor(Math.random() * bots.length)];

utils.webhook("WEBHOOK_URL", {
    name: bot.name,
    avatar: bot.icon,
    content: content
});
return null; // Don't send original message`,
  "Webhook: Stats": `// Tracks message count in memory and reports every 5th message
storage.total = (storage.total || 0) + 1;
if (storage.total % 5 === 0) {
    utils.webhook("WEBHOOK_URL", {
        name: "Stats Bot",
        content: "User has sent " + storage.total + " messages so far!"
    });
}
return content;`
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.04)", // Surface Container
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  deleteButton: {
    backgroundColor: "rgba(237, 66, 69, 0.15)", // Tonal Error
    padding: 12,
    borderRadius: 24,
    alignItems: "center",
    marginTop: 16,
    borderWidth: 1,
    borderColor: "rgba(237, 66, 69, 0.3)",
  },
  deleteButtonText: {
    color: "#ff8f8f",
    fontWeight: "600",
  },
  addButton: {
    backgroundColor: "#5865f2", // Primary
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 20,
    elevation: 2,
  },
  secondaryButton: {
    backgroundColor: "rgba(255, 255, 255, 0.08)", // Tonal
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
  scriptInput: {
     fontFamily: "monospace",
     fontSize: 13,
     backgroundColor: "rgba(0,0,0,0.3)",
     borderRadius: 12,
     padding: 12,
     color: "#e0e0e0",
     marginTop: 8,
  },
  modalContent: {
    flex: 1,
    backgroundColor: "#1c1b1f", // M3 Dark Surface
    padding: 24,
  },
  modalHeader: {
    fontSize: 24,
    fontWeight: "normal",
    color: "white",
    marginBottom: 16,
    letterSpacing: 0.5,
  }
});

function applyStyle(text: string, style: NoteStyle): string {
  if (typeof text !== "string") return "";
  switch (style) {
    case "subtext": return "-# " + text;
    case "blockquote": return "> " + text;
    case "code": return "`" + text + "`";
    default: return text;
  }
}

function processPlaceholders(text: string, triggerMatch: string, content: string, channelId: string): Promise<string> {
  if (typeof text !== "string") return Promise.resolve("");
  const now = new Date();
  
  const channel = ChannelStore?.getChannel?.(channelId);
  const guild = ChannelStore?.getGuild?.(channelId) || GuildStore?.getGuild?.(channel?.guild_id);
  const user = UserStore?.getCurrentUser?.();

  let result = text
    .replace(/{trigger}/g, triggerMatch || "")
    .replace(/{time}/g, now.toLocaleTimeString())
    .replace(/{date}/g, now.toLocaleDateString())
    .replace(/{wordCount}/g, String((content || "").split(/\s+/).filter(Boolean).length))
    .replace(/{channel}/g, channel?.name || "Unknown")
    .replace(/{channelID}/g, channelId)
    .replace(/{server}/g, guild?.name || "Direct Message")
    .replace(/{serverID}/g, guild?.id || "0")
    .replace(/{user}/g, user?.username || "Unknown")
    .replace(/{mention:(\d+)}/g, (_, id) => `<@${id}>`);

  // Handle {random:A,B,C}
  result = result.replace(/{random:([^}]+)}/g, (_, options) => {
    const choices = options.split(",").map((s: string) => s.trim());
    return choices[Math.floor(Math.random() * choices.length)];
  });

  // Handle {clipboard}
  const handleClipboard = (resText: string): Promise<string> => {
      if (resText.includes("{clipboard}")) {
          try {
              return Promise.resolve(Clipboard?.getString?.() || "").then(clip => {
                  return resText.replace(/{clipboard}/g, clip || "");
              }).catch(() => resText.replace(/{clipboard}/g, ""));
          } catch(e) { return Promise.resolve(resText.replace(/{clipboard}/g, "")); }
      }
      return Promise.resolve(resText);
  };

  // Handle {api:url}
  const handleAPI = (resText: string): Promise<string> => {
      const apiMatches = resText.match(/{api:([^}]+)}/g);
      if (!apiMatches) return Promise.resolve(resText);
      
      let p = Promise.resolve(resText);
      apiMatches.forEach(match => {
          p = p.then(current => {
              const url = match.slice(5, -1);
              return fetch(url).then(r => r.text()).then(textRes => {
                  return current.replace(match, (textRes || "").slice(0, 500));
              }).catch(e => {
                  console.error("[AutoNote] API fetch failed:", e);
                  return current.replace(match, "");
              });
          });
      });
      return p;
  };

  return handleClipboard(result).then(handleAPI);
}

function isScoped(note: AutoNote, channelId: string): boolean {
    if (!note || typeof channelId !== "string") return true;
    if (typeof note.whitelist === "string" && note.whitelist.trim()) {
        const ids = note.whitelist.split(",").map(s => s.trim()).filter(Boolean);
        if (ids.length > 0 && !ids.includes(channelId)) return false;
    }
    if (typeof note.blacklist === "string" && note.blacklist.trim()) {
        const ids = note.blacklist.split(",").map(s => s.trim()).filter(Boolean);
        if (ids.length > 0 && ids.includes(channelId)) return false;
    }
    return true;
}

function addAutoNote(content: string, notes: AutoNote[], utils: any, channelId: string): Promise<string | null> {
  if (typeof content !== "string") return Promise.resolve(content);
  let matchedSpecific = false;

  const runScript = (note: AutoNote, currentContent: string) => {
    if (!note.script) return Promise.resolve(currentContent);
    try {
      const data = note.data || {};
      // Wrap script in a function that returns the result, possibly as a Promise
      const scriptFn = new Function("content", "note", "utils", "storage", note.script);
      return Promise.resolve(scriptFn(currentContent, note, utils, data)).then(result => {
          note.data = data; // Ensure changes to "storage" are preserved
          if (result === null) return null;
          return typeof result === "string" ? result : currentContent;
      }).catch(e => {
          console.error("[AutoNote] Script error in profile " + (note.trigger || "default") + ":", e);
          return currentContent;
      });
    } catch (e) {
      console.error("[AutoNote] Script error in profile " + (note.trigger || "default") + ":", e);
      return Promise.resolve(currentContent);
    }
  };

  const safeNotes = Array.isArray(notes) ? notes.filter(n => n && n.enabled !== false) : [];
  let p = Promise.resolve(content as string | null);

  for (const note of safeNotes) {
    p = p.then(current => {
        if (current === null || !note.trigger || !isScoped(note, channelId)) return current;
        
        let match: RegExpMatchArray | null = null;
        let triggerRegex: RegExp;

        try {
            if (note.isRegex) {
                if (!note.trigger) return current;
                triggerRegex = new RegExp(note.trigger, "i");
                match = current.match(triggerRegex);
            } else {
                const escapedTrigger = note.trigger.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                triggerRegex = new RegExp("^\\s*" + escapedTrigger + "(?![\\w])", "i");
                match = current.match(triggerRegex);
            }
        } catch(e) { 
            if (note.isRegex) {
                console.warn("[AutoNote] Invalid Regex in profile: " + note.trigger);
            } else {
                console.error("[AutoNote] Trigger matching error:", e); 
            }
            return current; 
        }

        if (!match) return current;

        matchedSpecific = true;
        const matchedText = match[0].trim();
        let processedContent = current;
        if (note.removeTrigger) {
          processedContent = current.replace(triggerRegex, "").trim();
        }

        return runScript(note, processedContent).then(scriptResult => {
            if (scriptResult === null) return null;
            return processPlaceholders(note.footer || "", matchedText, scriptResult, channelId).then(addedText => {
                const position = note.position || "bottom";
                const styledText = applyStyle(addedText, note.style || "none");
                if (!styledText) return scriptResult;
                return position === "top" ? styledText + "\n" + scriptResult : scriptResult + "\n" + styledText;
            });
        });
    });
  }

  p = p.then(current => {
      if (current === null || matchedSpecific) return current;
      
      let pFallback = Promise.resolve(current as string | null);
      for (const note of safeNotes) {
        if (note.trigger) continue; // Skip if it has a trigger
        
        pFallback = pFallback.then(curr => {
            if (curr === null || !isScoped(note, channelId)) return curr;
            return runScript(note, curr).then(scriptResult => {
                if (scriptResult === null) return null;
                return processPlaceholders(note.footer || "", "", scriptResult, channelId).then(addedText => {
                    const position = note.position || "bottom";
                    const styledText = applyStyle(addedText, note.style || "none");
                    if (!styledText) return scriptResult;
                    return position === "top" ? styledText + "\n" + scriptResult : scriptResult + "\n" + styledText;
                });
            });
        });
      }
      return pFallback;
  });

  return p;
}

// Migration / Validation
function validateStorage() {
    if (!Array.isArray(storage.notes)) {
        storage.notes = [
            {
              id: Math.random().toString(36).slice(2),
              enabled: true,
              trigger: "@silent",
              footer: "This was sent as a {trigger} message to avoid annoyance",
              removeTrigger: false,
              style: "subtext",
              position: "bottom",
              data: {},
              icon: "🥷"
            },
        ];
        return;
    }

    let changed = false;
    storage.notes.forEach(n => {
        if (!n) return;
        if (n.enabled === undefined) { n.enabled = true; changed = true; }
        if (typeof n.trigger !== "string") { n.trigger = n.trigger ? String(n.trigger) : ""; changed = true; }
        if (typeof n.footer !== "string") { n.footer = n.footer ? String(n.footer) : ""; changed = true; }
        if (typeof n.whitelist !== "string") { n.whitelist = n.whitelist ? String(n.whitelist) : ""; changed = true; }
        if (typeof n.blacklist !== "string") { n.blacklist = n.blacklist ? String(n.blacklist) : ""; changed = true; }
        if (!n.style) { n.style = "none"; changed = true; }
        if (!n.position) { n.position = "bottom"; changed = true; }
        if (!n.data) { n.data = {}; changed = true; }
    });
    if (changed) storage.notes = [...storage.notes];
}

validateStorage();

const patches = [];

// Use INSTEAD to allow true cancellation
patches.push(instead("sendMessage", MessageActions, (args, orig) => {
    const channelId = args[0];
    const message = args[1];
    
    if (typeof message?.content !== "string" || message?.__autoNoteProcessed) {
        return orig(...args);
    }
    
    const channel = ChannelStore?.getChannel?.(channelId);
    const guild = ChannelStore?.getGuild?.(channelId) || GuildStore?.getGuild?.(channel?.guild_id);
    const user = UserStore?.getCurrentUser?.();

    const afterCallbacks: ((id: string) => void)[] = [];
    const utils = {
        channel: channel?.name || "Unknown",
        channelID: channelId,
        server: guild?.name || "Direct Message",
        serverID: guild?.id || "0",
        user: user,
        send: (msg: string) => MessageActions.sendMessage(channelId, { content: msg, __autoNoteProcessed: true }),
        delete: (messageId: string) => MessageActions.deleteMessage?.(channelId, messageId),
        edit: (messageId: string, msg: string) => MessageActions.editMessage?.(channelId, messageId, { content: msg }),
        copy: (text: string) => Clipboard?.setString?.(text),
        fetch: (url: string, opts?: any) => fetch(url, opts),
        log: (...args: any[]) => console.log("[AutoNote Script]", ...args),
        sleep: (ms: number) => new Promise(res => setTimeout(res, ms)),
        stop: () => null,
        webhook: (urlOrData: string | any, data?: any) => {
            const url = typeof urlOrData === "string" ? urlOrData : urlOrData?.url;
            const payload = typeof urlOrData === "string" ? data : urlOrData;
            if (!url) return Promise.reject("No webhook URL provided");
            
            const body = {
                content: payload?.content,
                username: payload?.name || payload?.username,
                avatar_url: payload?.avatar || payload?.avatar_url
            };

            // Try using Discord's internal HTTP module first to bypass CORS/Browser blocks
            if (HTTP?.post) {
                return HTTP.post({
                    url,
                    body,
                    headers: { "Content-Type": "application/json" }
                });
            }

            return fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });
        },
        runAfter: (cb: (id: string) => void) => afterCallbacks.push(cb)
    };

    return addAutoNote(message.content, storage.notes, utils, channelId).then(result => {
        if (result === null) {
            return {
                id: "0",
                channel_id: channelId,
                content: "",
                author: { id: "0", username: "Clyde" },
                attachments: [],
                embeds: [],
                mentions: [],
                timestamp: new Date().toISOString()
            };
        }

        message.content = result;
        const res = orig(...args);

        if (afterCallbacks.length > 0 && res && typeof res.then === "function") {
            res.then((msg: any) => {
                const id = msg?.id || msg?.body?.id || msg?.message?.id;
                if (id) {
                    afterCallbacks.forEach((cb: any) => {
                        try { cb(id); } catch(e) { console.error("[AutoNote] runAfter callback error:", e); }
                    });
                }
            }).catch((e: any) => console.error("[AutoNote] sendMessage promise failed:", e));
        }
        return res;
    }).catch(e => {
        console.error("[AutoNote] critical error in addAutoNote:", e);
        return orig(...args);
    });
}));

export const onUnload = () => patches.forEach(p => p());

export const settings = () => {
  const [notes, setNotes] = React.useState<AutoNote[]>(() => {
      const currentNotes = Array.isArray(storage.notes) ? [...storage.notes] : [];
      let changed = false;
      currentNotes.forEach(n => {
          if (n.enabled === undefined) { n.enabled = true; changed = true; }
          if (typeof n.trigger !== "string") { n.trigger = n.trigger ? String(n.trigger) : ""; changed = true; }
          if (typeof n.footer !== "string") { n.footer = n.footer ? String(n.footer) : ""; changed = true; }
          if (typeof n.whitelist !== "string") { n.whitelist = n.whitelist ? String(n.whitelist) : ""; changed = true; }
          if (typeof n.blacklist !== "string") { n.blacklist = n.blacklist ? String(n.blacklist) : ""; changed = true; }
          if (!n.style) { n.style = "none"; changed = true; }
          if (!n.position) { n.position = "bottom"; changed = true; }
          if (!n.data) { n.data = {}; changed = true; }
      });
      if (changed) storage.notes = currentNotes;
      return currentNotes;
  });
  
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>(() => {
      const initial: Record<string, boolean> = {};
      (Array.isArray(notes) ? notes : []).forEach((n: any) => { initial[n.id] = true; });
      return initial;
  });
  const [selectingStyle, setSelectingStyle] = React.useState<string | null>(null);
  const [modalScript, setModalScript] = React.useState<{id: string, code: string} | null>(null);
  const [showTemplates, setShowTemplates] = React.useState<string | null>(null); // profile id

  const toggleCollapsed = (id: string) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleSelectingStyle = (id: string) => setSelectingStyle(prev => (prev === id ? null : id));
  const updateNotes = (newNotes: AutoNote[]) => { storage.notes = newNotes; setNotes([...newNotes]); };

  const addNote = (profile?: Partial<AutoNote>) => {
    const newNote: AutoNote = {
      id: Math.random().toString(36).slice(2),
      enabled: true, trigger: "", footer: "", removeTrigger: false, style: "none", position: "bottom", data: {}, icon: "📝",
      ...profile
    };
    updateNotes([...notes, newNote]);
  };

  const deleteNote = (id: string) => updateNotes(notes.filter((n) => n.id !== id));
  const updateNote = (id: string, partial: Partial<AutoNote>) => updateNotes(notes.map((n) => (n.id === id ? { ...n, ...partial } : n)));

  const exportProfile = (note: AutoNote) => {
      try {
          // UTF-8 safe base64
          const json = JSON.stringify(note);
          const data = btoa(encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode(parseInt(p1, 16))));
          Clipboard?.setString?.(data);
      } catch(e) { console.error("[AutoNote] Export failed:", e); }
  };

  const importProfile = () => {
      Promise.resolve(Clipboard?.getString?.() || "").then(data => {
          if (!data) return;
          try {
              const json = decodeURIComponent(atob(data).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
              const profile = JSON.parse(json);
              delete profile.id; // Generate new ID
              addNote(profile);
          } catch(e) { console.error("[AutoNote] Import failed:", e); }
      });
  };

  if (!TableRowGroup || !TableSwitchRow || !TableRow || !Stack || !TextInput) {
    return React.createElement(ScrollView, { style: { flex: 1, padding: 12 } },
      React.createElement(Text, { style: { color: "white" } }, "AutoNote UI unavailable.")
    );
  }

  return React.createElement(ScrollView, { style: { flex: 1 } },
    React.createElement(Stack, { spacing: 8, style: { padding: 10 } },
      notes.map((note) =>
        React.createElement(View, { key: note.id, style: styles.card },
          React.createElement(TouchableOpacity, { onPress: () => toggleCollapsed(note.id), style: styles.headerRow },
            React.createElement(Text, { style: { color: "white", fontWeight: "bold", fontSize: 16 } }, 
              `${collapsed[note.id] ? "▶" : "▼"} ${note.icon || "📝"} ${note.trigger ? (note.isRegex ? "/" + note.trigger + "/" : "Trigger: " + note.trigger) : "Global Fallback"}`
            ),
            React.createElement(Text, { style: { color: note.enabled ? "#43b581" : "#f04747", fontSize: 12 } }, 
                note.enabled ? "ACTIVE" : "DISABLED"
            )
          ),
          
          !collapsed[note.id] && React.createElement(View, { style: { marginTop: 10 } },
            React.createElement(TableRowGroup, null,
              React.createElement(TableSwitchRow, { label: "Enabled", value: note.enabled, onValueChange: (v: boolean) => updateNote(note.id, { enabled: v }) }),
              React.createElement(TextInput, { label: "Icon Emoji", value: note.icon || "📝", onChange: (v: string) => updateNote(note.id, { icon: v }) }),
              React.createElement(TextInput, { label: "Trigger Keyword", placeholder: "Leave empty for every message...", value: note.trigger, onChange: (v: string) => updateNote(note.id, { trigger: v }) }),
              React.createElement(TableSwitchRow, { label: "Use Regular Expression", value: note.isRegex || false, onValueChange: (v: boolean) => updateNote(note.id, { isRegex: v }) }),
              React.createElement(TextInput, { label: "Whitelist IDs", placeholder: "Comma-separated channel IDs...", value: note.whitelist || "", onChange: (v: string) => updateNote(note.id, { whitelist: v }) }),
              React.createElement(TextInput, { label: "Blacklist IDs", placeholder: "Comma-separated channel IDs...", value: note.blacklist || "", onChange: (v: string) => updateNote(note.id, { blacklist: v }) }),
              React.createElement(TextInput, { label: "Note Text", placeholder: "Enter text...", value: note.footer, onChange: (v: string) => updateNote(note.id, { footer: v }), multiline: true }),
              React.createElement(TableSwitchRow, { label: "Remove trigger from message", value: note.removeTrigger, onValueChange: (v: boolean) => updateNote(note.id, { removeTrigger: v }) }),
              React.createElement(TableRow, { label: "Position", subLabel: `Currently at: ${(note.position || "bottom").toUpperCase()}`, onPress: () => updateNote(note.id, { position: (note.position || "bottom") === "top" ? "bottom" : "top" }) }),
              React.createElement(TableRow, { label: "Style", subLabel: `Current: ${(note.style || "none").toUpperCase()}`, onPress: () => toggleSelectingStyle(note.id) }),
              selectingStyle === note.id && React.createElement(View, { style: { paddingLeft: 16, backgroundColor: "rgba(0,0,0,0.1)" } },
                  (["none", "subtext", "blockquote", "code"] as NoteStyle[]).map(s => 
                      React.createElement(TableRow, {
                          key: s, label: s.toUpperCase(), selected: note.style === s,
                          onPress: () => { updateNote(note.id, { style: s }); toggleSelectingStyle(note.id); }
                      })
                  )
              ),
              React.createElement(View, { style: { padding: 16 } },
                  React.createElement(Text, { style: { color: "#bbb", marginBottom: 8, fontSize: 12 } }, "Custom Script (JS)"),
                  React.createElement(TextInput, {
                    placeholder: "utils.runAfter(id => utils.delete(id));",
                    multiline: true, value: note.script || "", onChange: (v: string) => updateNote(note.id, { script: v }), style: styles.scriptInput
                  }),
                  React.createElement(View, { style: { flexDirection: "row", gap: 8 } },
                      React.createElement(TouchableOpacity, { style: [styles.secondaryButton, { flex: 1 }], onPress: () => setModalScript({ id: note.id, code: note.script || "" }) },
                          React.createElement(Text, { style: styles.buttonText }, "🖥️ Big Editor")
                      ),
                      React.createElement(TouchableOpacity, { style: [styles.secondaryButton, { flex: 1 }], onPress: () => setShowTemplates(note.id) },
                          React.createElement(Text, { style: styles.buttonText }, "📚 Templates")
                      )
                  ),
                  React.createElement(TouchableOpacity, { style: styles.secondaryButton, onPress: () => exportProfile(note) },
                      React.createElement(Text, { style: styles.buttonText }, "📤 Export Profile (Copy String)")
                  )
              )
            ),
            React.createElement(TouchableOpacity, { style: styles.deleteButton, onPress: () => deleteNote(note.id) },
              React.createElement(Text, { style: styles.deleteButtonText }, "Delete Profile")
            )
          )
        )
      ),
      React.createElement(TouchableOpacity, { style: styles.addButton, onPress: () => addNote() },
        React.createElement(Text, { style: styles.buttonText }, "+ Add New Profile")
      ),
      React.createElement(TouchableOpacity, { style: [styles.addButton, { backgroundColor: "#4e5058" }], onPress: importProfile },
        React.createElement(Text, { style: styles.buttonText }, "📥 Import Profile from Clipboard")
      ),
      React.createElement(TableRowGroup, { title: "Info" },
        React.createElement(TableRow, { label: "Placeholders", subLabel: "{trigger}, {time}, {date}, {wordCount}, {clipboard}, {random:A,B}, {api:url}, {channel}, {channelID}, {server}, {serverID}, {user}, {mention:ID}", disabled: true }),
        React.createElement(TableRow, {
            label: "Script Context",
            subLabel: "content, note, storage, utils (send, delete, edit, copy, runAfter, fetch, log, webhook, sleep, stop). Return null to cancel.",
            disabled: true,
        })
      )
    ),

    modalScript && React.createElement(ReactNative.Modal, { visible: true, animationType: "slide" },
        React.createElement(View, { style: styles.modalContent },
            React.createElement(Text, { style: styles.modalHeader }, "Big Script Editor"),
            React.createElement(TextInput, {
                style: [styles.scriptInput, { flex: 1, textAlignVertical: "top" }],
                multiline: true,
                value: modalScript.code,
                onChange: (v: string) => setModalScript({ ...modalScript, code: v })
            }),
            React.createElement(TouchableOpacity, { 
                style: [styles.addButton, { marginTop: 16 }], 
                onPress: () => {
                    updateNote(modalScript.id, { script: modalScript.code });
                    setModalScript(null);
                } 
            },
                React.createElement(Text, { style: styles.buttonText }, "SAVE & CLOSE")
            )
        )
    ),

    showTemplates && React.createElement(ReactNative.Modal, { visible: true, animationType: "fade", transparent: true },
        React.createElement(View, { style: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", padding: 20 } },
            React.createElement(View, { style: { backgroundColor: "#2c2f33", borderRadius: 8, padding: 16, maxHeight: "80%" } },
                React.createElement(Text, { style: [styles.modalHeader, { marginBottom: 16 }] }, "Select Template"),
                React.createElement(ScrollView, null,
                    Object.keys(TEMPLATES).map(name => 
                        React.createElement(TouchableOpacity, { 
                            key: name, 
                            style: [styles.secondaryButton, { padding: 12, marginBottom: 8, alignItems: "flex-start" }],
                            onPress: () => {
                                updateNote(showTemplates, { script: TEMPLATES[name] });
                                setShowTemplates(null);
                            }
                        },
                            React.createElement(Text, { style: [styles.buttonText, { fontSize: 16 }] }, name),
                            React.createElement(Text, { style: { color: "#aaa", fontSize: 12, marginTop: 4 } }, TEMPLATES[name].split("\n")[0].replace("// ", ""))
                        )
                    )
                ),
                React.createElement(TouchableOpacity, { 
                    style: [styles.addButton, { marginTop: 16, marginBottom: 0 }], 
                    onPress: () => setShowTemplates(null) 
                },
                    React.createElement(Text, { style: styles.buttonText }, "CANCEL")
                )
            )
        )
    )
  );
};
