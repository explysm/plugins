import { findByProps } from "@vendetta/metro";
import { React, ReactNative } from "@vendetta/metro/common";
import { after, before, instead } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";

const { ScrollView, Text, TouchableOpacity, StyleSheet, View, LayoutAnimation, TextInput: RNTextInput, Platform, Alert } = ReactNative;

// Find internal modules
const MessageActions = findByProps("sendMessage", "receiveMessage");
const MessageStore = findByProps("getMessage", "getMessages");
const FluxDispatcher = findByProps("_dispatch", "dispatch");
const ReactionActions = findByProps("addReaction", "removeReaction");
const Clipboard = findByProps("setString", "getString");
const ChannelStore = findByProps("getChannel", "getChannels");
const GuildStore = findByProps("getGuild", "getGuilds");
const UserStore = findByProps("getCurrentUser", "getUser");
const HTTP = findByProps("get", "post", "put");
const { showToast } = findByProps("showToast") || {};

// Fallback if findByProps fails for stores
const InternalChannelStore = findByProps("getChannel", "getChannels") || findByProps("getChannel");
const InternalGuildStore = findByProps("getGuild", "getGuilds") || findByProps("getGuild");

// UI Components
const TableRowGroup = findByProps("TableRowGroup")?.TableRowGroup;
const TableRow = findByProps("TableRow")?.TableRow;
const TableSwitchRow = findByProps("TableSwitchRow")?.TableSwitchRow;
const Stack = findByProps("Stack")?.Stack;
const TextInput = findByProps("TextInput")?.TextInput;

type NoteStyle = "none" | "subtext" | "blockquote" | "code";
type NotePosition = "top" | "bottom";
type MatchMode = "starts_with" | "contains" | "exact" | "regex";

interface AutoNote {
  id: string;
  enabled: boolean;
  trigger: string;
  matchMode?: MatchMode;
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
  "Webhook: Embed": `// Sends a rich embed via Webhook
utils.webhook("WEBHOOK_URL", {
    name: utils.user.username,
    avatar: utils.user.avatarURL,
    embeds: [{
        title: "AutoNote Embed",
        description: content,
        color: 0x5865f2,
        timestamp: new Date().toISOString(),
        footer: { text: "Sent from #" + utils.channel }
    }]
});
return null; // Cancel original message`,
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
return content;`,
  "Profanity Counter": `// Checks for profanity and keeps a total count
return utils.fetch("https://vector.profanity.dev", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: content })
}).then(r => r.json()).then(res => {
    if (res.isProfane) {
        utils.storage.badWords = (utils.storage.badWords || 0) + 1;
        utils.toast("Profanity detected! Total: " + utils.storage.badWords);
        return content + "\\n-# ⚠️ Swear count: " + utils.storage.badWords;
    }
    return content;
});`
};

const SNIPPETS = [
    { label: "send", code: 'utils.send("");' },
    { label: "fetch", code: 'utils.fetch("").then(r => r.json())' },
    { label: "del", code: 'utils.delete(id);' },
    { label: "copy", code: 'utils.copy(content);' },
    { label: "wait", code: 'await utils.sleep(1000);' },
    { label: "hook", code: 'utils.webhook("", { content: "" });' },
    { label: "log", code: 'utils.log("");' },
    { label: "react", code: 'utils.react(id, "🔥");' },
    { label: "read", code: 'const msgs = utils.read(5);' },
    { label: "onMsg", code: 'utils.onMessage("aura", "contains", async (msg) => {\n  await utils.sleep(500);\n  utils.react(msg.id, "🔥");\n});' },
    { label: "after", code: 'utils.runAfter(id => {\n  \n});' },
    { label: "if", code: 'if (content.includes("")) {\n  \n}' }
];

const COMMON_EMOJIS = ["📝", "🥷", "🤖", "📢", "💬", "✨", "🔥", "🌈", "🛡️", "🚀", "⚠️", "✅", "❌", "📦", "🔗", "💰", "🎮", "🎵", "📷", "💡"];

const CodeEditor = ({ value, onChange, style }: { value: string, onChange: (v: string) => void, style?: any }) => {
    const handleTextChange = (text: string) => {
        // Basic Auto-Indent
        if (text.length > value.length && text.endsWith("\n")) {
            const lines = text.split("\n");
            const lastLine = lines[lines.length - 2]; 
            const indentMatch = lastLine.match(/^(\s*)/);
            if (indentMatch) {
                let indent = indentMatch[1];
                if (lastLine.trim().endsWith("{")) indent += "  ";
                onChange(text + indent);
                return;
            }
        }
        onChange(text);
    };

    return React.createElement(RNTextInput, {
        style: [styles.editorContainer, styles.codeText, style],
        multiline: true,
        value: value,
        onChangeText: handleTextChange,
        autoCapitalize: "none",
        autoCorrect: false,
        spellCheck: false,
        selectionColor: "rgba(255,255,255,0.3)",
        underlineColorAndroid: "transparent"
    });
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#2b2d31",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  deleteButton: {
    backgroundColor: "rgba(237, 66, 69, 0.1)", 
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,
    borderWidth: 1,
    borderColor: "rgba(237, 66, 69, 0.2)",
  },
  deleteButtonText: {
    color: "#ff8f8f",
    fontWeight: "600",
  },
  addButton: {
    backgroundColor: "#5865f2", 
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 12,
    elevation: 2,
  },
  secondaryButton: {
    backgroundColor: "rgba(255, 255, 255, 0.06)", 
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
  editorContainer: {
     backgroundColor: "rgba(0,0,0,0.25)",
     borderRadius: 12,
     marginTop: 8,
     padding: 12,
     minHeight: 100,
     textAlignVertical: "top",
  },
  codeText: {
      fontFamily: Platform?.select({ ios: "Courier", android: "monospace" }) || "monospace",
      fontSize: 13,
      lineHeight: 18,
      includeFontPadding: false,
      color: "#f8f8f2",
  },
  modalContent: {
    flex: 1,
    backgroundColor: "#1e1f22", 
    padding: 20,
  },
  modalHeader: {
    fontSize: 22,
    fontWeight: "600",
    color: "white",
    marginBottom: 16,
  },
  snippetScroll: {
      marginBottom: 10,
      height: 28,
      flexGrow: 0,
  },
  snippetTag: {
      backgroundColor: "#4e5058",
      paddingHorizontal: 10,
      borderRadius: 6,
      marginRight: 6,
      height: 24,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.05)",
  },
  logItem: {
      padding: 8,
      borderBottomWidth: 1,
      borderBottomColor: "rgba(255,255,255,0.05)",
  },
  reorderBtn: {
      padding: 8,
      backgroundColor: "rgba(255,255,255,0.05)",
      borderRadius: 8,
      marginLeft: 8,
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
  
  const channel = (InternalChannelStore || ChannelStore)?.getChannel?.(channelId);
  const guild = (InternalGuildStore || GuildStore)?.getGuild?.(channel?.guild_id);
  const user = UserStore?.getCurrentUser?.();

  let result = text
    .replace(/{trigger}/g, triggerMatch || "")
    .replace(/{time}/g, now.toLocaleTimeString())
    .replace(/{date}/g, now.toLocaleDateString())
    .replace(/{wordCount}/g, String((content || "").split(/\s+/).filter(Boolean).length))
    .replace(/{channel}/g, channel?.name || (channel?.type === 1 ? "Direct Message" : "Unknown"))
    .replace(/{channelID}/g, channelId)
    .replace(/{server}/g, guild?.name || (channel?.type === 1 ? "DMs" : "Direct Message"))
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

function pushLog(msg: string) {
    if (!storage._logs) storage._logs = [];
    storage._logs.unshift(`[${new Date().toLocaleTimeString()}] ${msg}`);
    if (storage._logs.length > 50) storage._logs.pop();
}

function addAutoNote(content: string, notes: AutoNote[], baseUtils: any, channelId: string, message?: any): Promise<string | null> {
  if (typeof content !== "string") return Promise.resolve(content);
  let matchedSpecific = false;
  let finalContent = content;

  const runScript = (note: AutoNote, currentContent: string) => {
    if (!note.script) return Promise.resolve(currentContent);
    try {
      const data = note.data || {};
      if (!storage._global) storage._global = {};
      
      let scriptContent = currentContent;
      const utils = {
          ...baseUtils,
          storage: storage._global,
          toast: (msg: string) => showToast?.(msg),
          content: (c: string) => { scriptContent = c; return c; },
          onMessage: (pattern: string, mode: string, cb: Function) => {
              if (typeof cb !== "function") return;
              const lowContent = (currentContent || "").toLowerCase();
              const lowPattern = (pattern || "").toLowerCase();
              let matched = false;
              if (mode === "contains") matched = lowContent.includes(lowPattern);
              else if (mode === "startswith") matched = lowContent.startsWith(lowPattern);
              else if (mode === "match" || mode === "exact") matched = lowContent === lowPattern;
              else if (mode === "regex") { try { matched = new RegExp(pattern, "i").test(currentContent); } catch(e) {} }
              
              if (matched) cb({ content: currentContent, id: message?.id, author: message?.author, channelId });
          }
      };

      const scriptFn = new Function("content", "note", "utils", "storage", note.script);
      const scriptReturn = scriptFn(currentContent, note, utils, data);

      return Promise.resolve(scriptReturn).then(result => {
          note.data = data;
          if (result === null) return null;
          const resolved = typeof result === "string" ? result : scriptContent;
          finalContent = resolved;
          return resolved;
      }).catch(e => {
          pushLog(`Error in ${note.trigger || "Global"}: ${e.message}`);
          console.error("[AutoNote] Script error:", e);
          return currentContent;
      });
    } catch (e) {
      pushLog(`Compile error in ${note.trigger || "Global"}: ${e.message}`);
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
            const mode = note.matchMode || (note.isRegex ? "regex" : "starts_with");
            const escapedTrigger = note.trigger.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            
            if (mode === "regex") {
                triggerRegex = new RegExp(note.trigger, "i");
            } else if (mode === "contains") {
                triggerRegex = new RegExp(escapedTrigger, "i");
            } else if (mode === "exact") {
                triggerRegex = new RegExp("^\\s*" + escapedTrigger + "\\s*$", "i");
            } else { // starts_with
                triggerRegex = new RegExp("^\\s*" + escapedTrigger + "(?![\\w])", "i");
            }
            
            match = current.match(triggerRegex);
        } catch(e) { return current; }

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
        if (note.trigger) continue;
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

function validateStorage() {
    try {
        if (!Array.isArray(storage.notes)) {
            storage.notes = [{ id: Math.random().toString(36).slice(2), enabled: true, trigger: "@silent", footer: "Sent as {trigger}", removeTrigger: false, style: "subtext", position: "bottom", data: {}, icon: "🥷", matchMode: "starts_with" }];
        } else {
            // Ensure all notes have an ID and necessary fields
            storage.notes = storage.notes.map(n => ({
                id: n.id || Math.random().toString(36).slice(2),
                enabled: n.enabled !== false,
                trigger: n.trigger || "",
                matchMode: n.matchMode || (n.isRegex ? "regex" : "starts_with"),
                footer: n.footer || "",
                removeTrigger: !!n.removeTrigger,
                style: n.style || "none",
                position: n.position || "bottom",
                data: n.data || {},
                icon: n.icon || "📝",
                isRegex: !!n.isRegex,
                script: n.script || "",
                whitelist: n.whitelist || "",
                blacklist: n.blacklist || ""
            }));
        }
        if (!Array.isArray(storage._logs)) storage._logs = [];
    } catch (e) {
        console.error("[AutoNote] Storage validation failed:", e);
        storage.notes = [];
        storage._logs = [];
    }
}

validateStorage();

function getUtils(channelId: string, afterCallbacks?: any[]) {
    const channel = (InternalChannelStore || ChannelStore)?.getChannel?.(channelId);
    const guild = (InternalGuildStore || GuildStore)?.getGuild?.(channel?.guild_id);
    const user = UserStore?.getCurrentUser?.();

    return {
        channel: channel?.name || (channel?.type === 1 ? "Direct Message" : "Unknown"),
        channelID: channelId,
        channelType: channel?.type === 1 || channel?.type === 3 ? 0 : 1, // 0 for DMs/Group DMs, 1 for Guilds
        server: guild?.name || (channel?.type === 1 ? "DMs" : "Direct Message"),
        serverID: guild?.id || "0",
        user: {
            ...user,
            avatarURL: user ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar?.startsWith("a_") ? "gif" : "png"}?size=1024` : null
        },
        send: (msg: string) => MessageActions.sendMessage(channelId, { content: msg, __autoNoteProcessed: true }),
        delete: (messageId: string) => MessageActions.deleteMessage?.(channelId, messageId),
        edit: (messageId: string, msg: string) => MessageActions.editMessage?.(channelId, messageId, { content: msg }),
        react: (msgId: string, emoji: string) => {
            const reactionEmoji = emoji.includes(":") ? { name: emoji.split(":")[0], id: emoji.split(":")[1] } : { name: emoji };
            setTimeout(() => {
                ReactionActions?.addReaction?.(channelId, msgId, reactionEmoji);
            }, 500);
        },
        read: (count: number) => {
            const messages = MessageStore?.getMessages?.(channelId);
            if (!messages) return [];
            const arr = messages.toArray?.() || Object.values(messages._ordered || {}) || [];
            return arr.slice(-count).map((m: any) => ({
                id: m.id,
                content: m.content,
                author: m.author,
                timestamp: m.timestamp,
                reactions: m.reactions
            }));
        },
        copy: (text: string) => Clipboard?.setString?.(text),
        fetch: (url: string, opts?: any) => {
            const method = opts?.method?.toLowerCase() || "get";
            if (HTTP && (HTTP as any)[method]) {
                return (HTTP as any)[method]({ url, body: opts?.body, headers: opts?.headers }).then((res: any) => ({
                    ok: res.ok || (res.status >= 200 && res.status < 300),
                    status: res.status,
                    json: () => Promise.resolve(res.body),
                    text: () => Promise.resolve(typeof res.body === "string" ? res.body : JSON.stringify(res.body))
                }));
            }
            return fetch(url, opts);
        },
        log: (...args: any[]) => pushLog(args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ")),
        toast: (msg: string) => showToast?.(msg),
        sleep: (ms: number) => new Promise(res => setTimeout(res, ms)),
        stop: () => null,
        content: (newContent: string) => { return newContent; }, // Handled in runScript
        webhook: (urlOrData: string | any, data?: any) => {
            const url = typeof urlOrData === "string" ? urlOrData : urlOrData?.url;
            const payload = typeof urlOrData === "string" ? data : urlOrData;
            if (!url) return Promise.reject("No webhook URL provided");
            const body = { 
                content: payload?.content, 
                username: payload?.name || payload?.username, 
                avatar_url: payload?.avatar || payload?.avatar_url,
                embeds: payload?.embeds 
            };
            if (HTTP?.post) return HTTP.post({ url, body, headers: { "Content-Type": "application/json" } });
            return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        },
        runAfter: (cb: (id: string) => void) => afterCallbacks?.push(cb)
    };
}

const patches = [];

patches.push(instead("sendMessage", MessageActions, (args, orig) => {
    const channelId = args[0];
    const message = args[1];
    if (typeof message?.content !== "string" || message?.__autoNoteProcessed) return orig(...args);
    
    const afterCallbacks: ((id: string) => void)[] = [];
    const utils = getUtils(channelId, afterCallbacks);

    const notesSnapshot = Array.isArray(storage.notes) ? JSON.parse(JSON.stringify(storage.notes)) : [];
    return addAutoNote(message.content, notesSnapshot, utils, channelId, message).then(result => {
        if (result === null) return { id: "0", channel_id: channelId, content: "", author: { id: "0", username: "Clyde" }, attachments: [], embeds: [], mentions: [], timestamp: new Date().toISOString() };
        message.content = result;
        const res = orig(...args);
        if (afterCallbacks.length > 0 && res?.then) {
            res.then((msg: any) => {
                const id = msg?.id || msg?.body?.id || msg?.message?.id;
                if (id) afterCallbacks.forEach(cb => { try { cb(id); } catch(e) {} });
            });
        }
        return res;
    }).catch(e => {
        console.error("[AutoNote] Error in sendMessage patch:", e);
        return orig(...args);
    });
}));

const onMessageCreate = ({ message }: { message: any }) => {
    if (!message || !message.channel_id || !message.content || message.__autoNoteProcessed) return;

    const channelId = message.channel_id;
    const utils = getUtils(channelId);
    const notesSnapshot = Array.isArray(storage.notes) ? JSON.parse(JSON.stringify(storage.notes)) : [];
    
    addAutoNote(message.content, notesSnapshot, utils, channelId, message);
};

FluxDispatcher.subscribe("MESSAGE_CREATE", onMessageCreate);

export const onUnload = () => {
    patches.forEach(p => p());
    FluxDispatcher.unsubscribe("MESSAGE_CREATE", onMessageCreate);
};

export const settings = () => {
  const [notes, setNotes] = React.useState<AutoNote[]>(() => {
      validateStorage();
      return [...(storage.notes || [])];
  });
  const [search, setSearch] = React.useState("");
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>(() => {
      const initial: Record<string, boolean> = {};
      (notes || []).forEach(n => { initial[n.id] = true; });
      return initial;
  });
  const [selectingStyle, setSelectingStyle] = React.useState<string | null>(null);
  const [modalScript, setModalScript] = React.useState<{id: string, code: string} | null>(null);
  const [showTemplates, setShowTemplates] = React.useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = React.useState<string | null>(null);
  const [logs, setLogs] = React.useState<string[]>(() => storage._logs || []);

  const updateNotes = (newNotes: AutoNote[]) => { 
      // Deep clone to avoid proxy issues and clean data
      const cleaned = JSON.parse(JSON.stringify(newNotes));
      storage.notes = cleaned; 
      setNotes(cleaned); 
  };

  const toggleCollapsed = (id: string) => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setCollapsed(prev => ({ ...prev, [id]: !prev[id] })); };

  const reorder = (index: number, direction: number) => {
      const newNotes = [...notes];
      const target = index + direction;
      if (target < 0 || target >= newNotes.length) return;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      [newNotes[index], newNotes[target]] = [newNotes[target], newNotes[index]];
      updateNotes(newNotes);
  };

  const addNote = (profile?: Partial<AutoNote>) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const newNote: AutoNote = { id: Math.random().toString(36).slice(2), enabled: true, trigger: "", footer: "", removeTrigger: false, style: "none", position: "bottom", data: {}, icon: "📝", ...profile };
    updateNotes([...notes, newNote]);
  };

  const deleteNote = (id: string) => { 
    Alert.alert("Delete Profile", "Are you sure you want to delete this profile? This cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); 
            updateNotes(notes.filter(n => n.id !== id)); 
        }}
    ]);
  };

  const updateNote = (id: string, partial: Partial<AutoNote>) => updateNotes(notes.map(n => (n.id === id ? { ...n, ...partial } : n)));

  const filteredNotes = notes.filter(n => 
    (n.trigger || "").toLowerCase().includes(search.toLowerCase()) || 
    (n.footer || "").toLowerCase().includes(search.toLowerCase())
  );

  const matchModes: MatchMode[] = ["starts_with", "contains", "exact", "regex"];

  return React.createElement(ScrollView, { style: { flex: 1 } },
    React.createElement(Stack, { spacing: 8, style: { padding: 10 } },
      React.createElement(TextInput, { 
        placeholder: "Search profiles...", 
        value: search, 
        onChange: (v: string) => setSearch(v),
        style: { marginBottom: 8 }
      }),
      filteredNotes.map((note) => {
        const idx = notes.findIndex(n => n.id === note.id);
        return React.createElement(View, { key: note.id, style: styles.card },
          React.createElement(View, { style: styles.headerRow },
            React.createElement(TouchableOpacity, { onPress: () => toggleCollapsed(note.id), style: { flex: 1, flexDirection: "row", alignItems: "center" } },
                React.createElement(Text, { style: { color: "white", fontWeight: "bold", fontSize: 16 } }, 
                  `${collapsed[note.id] ? "▶" : "▼"} ${note.icon || "📝"} ${note.trigger ? (note.matchMode === "regex" ? "/" + note.trigger + "/" : (note.matchMode || "Starts With") + ": " + note.trigger) : "Global Fallback"}`
                )
            ),
            React.createElement(View, { style: { flexDirection: "row" } },
                React.createElement(TouchableOpacity, { style: styles.reorderBtn, onPress: () => reorder(idx, -1) }, React.createElement(Text, { style: { color: "white" } }, "▲")),
                React.createElement(TouchableOpacity, { style: styles.reorderBtn, onPress: () => reorder(idx, 1) }, React.createElement(Text, { style: { color: "white" } }, "▼"))
            )
          ),
          
          !collapsed[note.id] && React.createElement(View, { style: { marginTop: 12 } },
            React.createElement(TableRowGroup, null,
              React.createElement(TableSwitchRow, { label: "Enabled", value: note.enabled, onValueChange: (v: boolean) => updateNote(note.id, { enabled: v }) }),
              React.createElement(TableRow, { label: "Icon Emoji", subLabel: note.icon || "📝", onPress: () => setShowEmojiPicker(note.id) }),
              React.createElement(TextInput, { label: "Trigger Keyword", placeholder: "Global Fallback...", value: note.trigger, onChange: (v: string) => updateNote(note.id, { trigger: v }) }),
              React.createElement(TableRow, { label: "Match Mode", subLabel: (note.matchMode || "starts_with").replace("_", " ").toUpperCase(), onPress: () => {
                  const currentIdx = matchModes.indexOf(note.matchMode || "starts_with");
                  const nextMode = matchModes[(currentIdx + 1) % matchModes.length];
                  updateNote(note.id, { matchMode: nextMode, isRegex: nextMode === "regex" });
              }}),
              React.createElement(TableSwitchRow, { label: "Remove Trigger from Message", value: note.removeTrigger || false, onValueChange: (v: boolean) => updateNote(note.id, { removeTrigger: v }) }),
              React.createElement(TextInput, { label: "Note Text", placeholder: "Enter text...", value: note.footer, onChange: (v: string) => updateNote(note.id, { footer: v }), multiline: true }),
              React.createElement(TableRow, { label: "Position", subLabel: (note.position || "bottom").toUpperCase(), onPress: () => updateNote(note.id, { position: (note.position || "bottom") === "top" ? "bottom" : "top" }) }),
              React.createElement(TableRow, { label: "Style", subLabel: (note.style || "none").toUpperCase(), onPress: () => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setSelectingStyle(selectingStyle === note.id ? null : note.id); } }),
              selectingStyle === note.id && React.createElement(View, { style: { paddingLeft: 16, backgroundColor: "rgba(0,0,0,0.1)" } },
                  (["none", "subtext", "blockquote", "code"] as NoteStyle[]).map(s => 
                      React.createElement(TableRow, { key: s, label: s.toUpperCase(), selected: note.style === s, onPress: () => { updateNote(note.id, { style: s }); setSelectingStyle(null); } })
                  )
              ),
              React.createElement(TextInput, { label: "Whitelist (Channel IDs)", placeholder: "Comma-separated IDs...", value: note.whitelist || "", onChange: (v: string) => updateNote(note.id, { whitelist: v }) }),
              React.createElement(TextInput, { label: "Blacklist (Channel IDs)", placeholder: "Comma-separated IDs...", value: note.blacklist || "", onChange: (v: string) => updateNote(note.id, { blacklist: v }) }),
              React.createElement(View, { style: { padding: 16 } },
                  React.createElement(Text, { style: { color: "#bbb", marginBottom: 8, fontSize: 12 } }, "Custom Script (JS)"),
                  React.createElement(CodeEditor, {
                    value: note.script || "", onChange: (v: string) => updateNote(note.id, { script: v })
                  }),
                  React.createElement(View, { style: { flexDirection: "row", gap: 8 } },
                      React.createElement(TouchableOpacity, { style: [styles.secondaryButton, { flex: 1 }], onPress: () => setModalScript({ id: note.id, code: note.script || "" }) }, React.createElement(Text, { style: styles.buttonText }, "🖥️ Editor")),
                      React.createElement(TouchableOpacity, { style: [styles.secondaryButton, { flex: 1 }], onPress: () => setShowTemplates(note.id) }, React.createElement(Text, { style: styles.buttonText }, "📚 Templates"))
                  ),
                  React.createElement(TouchableOpacity, { style: styles.secondaryButton, onPress: () => { Clipboard.setString(JSON.stringify(note)); pushLog("Profile copied!"); } }, React.createElement(Text, { style: styles.buttonText }, "📤 Export Profile"))
              )
            ),
            React.createElement(TouchableOpacity, { style: styles.deleteButton, onPress: () => deleteNote(note.id) }, React.createElement(Text, { style: styles.deleteButtonText }, "Delete Profile"))
          )
        );
      }),
      React.createElement(TouchableOpacity, { style: styles.addButton, onPress: () => addNote() }, React.createElement(Text, { style: styles.buttonText }, "+ Add Profile")),
      React.createElement(TouchableOpacity, { style: [styles.addButton, { backgroundColor: "#4e5058" }], onPress: () => {
          Promise.resolve(Clipboard.getString()).then(data => { try { const p = JSON.parse(data); delete p.id; addNote(p); } catch(e) {} });
      } }, React.createElement(Text, { style: styles.buttonText }, "📥 Import Profile")),

      React.createElement(TableRowGroup, { title: "Script Logs" },
          React.createElement(View, { style: { padding: 10, backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 12 } },
              logs.length === 0 ? React.createElement(Text, { style: { color: "#666", textAlign: "center" } }, "No logs yet.") :
              logs.map((log, i) => React.createElement(View, { key: i, style: styles.logItem }, React.createElement(Text, { style: { color: "#ccc", fontSize: 12, fontFamily: "monospace" } }, log))),
              React.createElement(TouchableOpacity, { style: [styles.secondaryButton, { marginTop: 10 }], onPress: () => { storage._logs = []; setLogs([]); } }, React.createElement(Text, { style: styles.buttonText }, "Clear Logs"))
          )
      ),
      React.createElement(TableRowGroup, { title: "Documentation" },
          React.createElement(TableRow, { label: "Placeholders", subLabel: "{trigger}, {time}, {date}, {wordCount}, {clipboard}, {random:A,B}, {api:url}, {channel}, {channelID}, {server}, {serverID}, {user}, {mention:ID}" }),
          React.createElement(TableRow, { label: "Script Context", subLabel: "content, note, storage, utils (send, delete, edit, react, read, onMessage, copy, runAfter, fetch, log, webhook, sleep, stop, content, channelType, toast, storage)" }),
          React.createElement(TableRow, { label: "utils.react(id, emoji)", subLabel: "Reacts to a message. Emoji can be '🔥' or 'name:id'." }),
          React.createElement(TableRow, { label: "utils.read(count)", subLabel: "Returns an array of the last 'count' messages in the channel." }),
          React.createElement(TableRow, { label: "utils.onMessage(query, mode, cb)", subLabel: "Runs callback if message matches. Modes: contains, startswith, match, regex." }),
          React.createElement(TableRow, { label: "utils.channelType", subLabel: "0 for DMs/Groups, 1 for Guilds." }),
          React.createElement(TableRow, { label: "utils.content(text)", subLabel: "Directly sets the final message content from within a script." }),
          React.createElement(TableRow, { label: "utils.toast(msg)", subLabel: "Shows a small popup at the bottom of the screen." }),
          React.createElement(TableRow, { label: "utils.storage", subLabel: "Global storage shared across all scripts." }),
          React.createElement(TableRow, { label: "utils.runAfter(cb)", subLabel: "Runs a callback after the message is sent. Callback receives the message 'id'. Useful for delayed actions like auto-delete." })
      )
    ),

    modalScript && React.createElement(ReactNative.Modal, { visible: true, animationType: "slide" },
        React.createElement(View, { style: styles.modalContent },
            React.createElement(Text, { style: styles.modalHeader }, "Script Editor"),
            React.createElement(ScrollView, { 
                horizontal: true, 
                style: styles.snippetScroll, 
                contentContainerStyle: { alignItems: "center", paddingRight: 10 },
                showsHorizontalScrollIndicator: false 
            },
                SNIPPETS.map(s => React.createElement(TouchableOpacity, { key: s.label, style: styles.snippetTag, onPress: () => setModalScript({ ...modalScript, code: modalScript.code + "\n" + s.code }) },
                    React.createElement(Text, { style: { color: "#eee", fontSize: 11, fontWeight: "600" } }, s.label)
                ))
            ),
            React.createElement(View, { style: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 16, overflow: "hidden" } },
                React.createElement(CodeEditor, {
                    style: { flex: 1, minHeight: "100%" },
                    value: modalScript.code,
                    onChange: (v: string) => setModalScript({ ...modalScript, code: v })
                })
            ),
            React.createElement(View, { style: { flexDirection: "row", gap: 12, marginTop: 16 } },
                React.createElement(TouchableOpacity, { style: [styles.addButton, { flex: 1, marginBottom: 0, backgroundColor: "#23a55a" }], onPress: () => { 
                    try {
                        if (modalScript.code.trim()) new Function("content", "note", "utils", "storage", modalScript.code);
                        updateNote(modalScript.id, { script: modalScript.code }); 
                        setModalScript(null); 
                    } catch(e) {
                        Alert.alert("Syntax Error", e.message);
                    }
                } }, React.createElement(Text, { style: styles.buttonText }, "SAVE")),
                React.createElement(TouchableOpacity, { style: [styles.addButton, { flex: 1, marginBottom: 0, backgroundColor: "#f04747" }], onPress: () => setModalScript(null) }, React.createElement(Text, { style: styles.buttonText }, "CANCEL"))
            )
        )
    ),

    showEmojiPicker && React.createElement(ReactNative.Modal, { visible: true, transparent: true, animationType: "fade" },
        React.createElement(TouchableOpacity, { style: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" }, onPress: () => setShowEmojiPicker(null) },
            React.createElement(View, { style: { backgroundColor: "#2b2d31", padding: 20, borderRadius: 24, width: "80%" } },
                React.createElement(Text, { style: [styles.modalHeader, { textAlign: "center" }] }, "Pick an Icon"),
                React.createElement(View, { style: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12 } },
                    COMMON_EMOJIS.map(e => React.createElement(TouchableOpacity, { key: e, style: { padding: 10, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12 }, onPress: () => { updateNote(showEmojiPicker, { icon: e }); setShowEmojiPicker(null); } },
                        React.createElement(Text, { style: { fontSize: 24 } }, e)
                    ))
                )
            )
        )
    ),

    showTemplates && React.createElement(ReactNative.Modal, { visible: true, animationType: "fade", transparent: true },
        React.createElement(View, { style: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", padding: 20 } },
            React.createElement(View, { style: { backgroundColor: "#2b2d31", borderRadius: 16, padding: 16, maxHeight: "80%" } },
                React.createElement(Text, { style: [styles.modalHeader, { marginBottom: 16 }] }, "Select Template"),
                React.createElement(ScrollView, null,
                    Object.keys(TEMPLATES).map(name => 
                        React.createElement(TouchableOpacity, { key: name, style: [styles.secondaryButton, { padding: 12, marginBottom: 8, alignItems: "flex-start" }], onPress: () => { updateNote(showTemplates, { script: TEMPLATES[name] }); setShowTemplates(null); } },
                            React.createElement(Text, { style: [styles.buttonText, { fontSize: 16 }] }, name),
                            React.createElement(Text, { style: { color: "#aaa", fontSize: 12, marginTop: 4 } }, TEMPLATES[name].split("\n")[0].replace("// ", ""))
                        )
                    )
                ),
                React.createElement(TouchableOpacity, { style: [styles.addButton, { marginTop: 16, marginBottom: 0 }], onPress: () => setShowTemplates(null) }, React.createElement(Text, { style: styles.buttonText }, "CANCEL"))
            )
        )
    )
  );
};
