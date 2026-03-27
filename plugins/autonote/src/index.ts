import { findByProps } from "@vendetta/metro";
import { React, ReactNative } from "@vendetta/metro/common";
import { after, before, instead } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";

const { ScrollView, Text, TouchableOpacity, StyleSheet, View, LayoutAnimation, TextInput: RNTextInput } = ReactNative;

// Find internal modules
const MessageActions = findByProps("sendMessage", "receiveMessage");
const Clipboard = findByProps("setString", "getString");
const ChannelStore = findByProps("getChannel", "getChannels");
const GuildStore = findByProps("getGuild", "getGuilds");
const UserStore = findByProps("getCurrentUser", "getUser");
const HTTP = findByProps("get", "post", "put");

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

const SNIPPETS = [
    { label: "send", code: 'utils.send("");' },
    { label: "fetch", code: 'utils.fetch("").then(r => r.json())' },
    { label: "delete", code: 'utils.delete(id);' },
    { label: "copy", code: 'utils.copy(content);' },
    { label: "sleep", code: 'await utils.sleep(1000);' },
    { label: "webhook", code: 'utils.webhook("", { content: "" });' },
    { label: "log", code: 'utils.log("");' },
    { label: "runAfter", code: 'utils.runAfter(id => {\n  \n});' },
    { label: "if", code: 'if (content.includes("")) {\n  \n}' }
];

const COMMON_EMOJIS = ["📝", "🥷", "🤖", "📢", "💬", "✨", "🔥", "🌈", "🛡️", "🚀", "⚠️", "✅", "❌", "📦", "🔗", "💰", "🎮", "🎵", "📷", "💡"];

const syntaxColors = {
    keyword: "#ff79c6",
    string: "#f1fa8c",
    comment: "#6272a4",
    function: "#50fa7b",
    number: "#bd93f9",
    text: "#f8f8f2"
};

const highlightJS = (code: string) => {
    if (!code) return [];
    const tokens = [];
    const regex = /(\/\/.*)|(".*?"|'.*?'|`.*?`)|(\b(const|let|var|if|else|for|while|return|function|async|await|new|try|catch|null|undefined|true|false)\b)|(\b(utils|storage|console|Math|JSON|Promise)\b)|(\d+)|([^\s\w]+)|(\w+)/g;
    let match;
    let lastIndex = 0;

    while ((match = regex.exec(code)) !== null) {
        const [full, comment, string, keyword, builtin, number, operator, word] = match;
        
        let color = syntaxColors.text;
        if (comment) color = syntaxColors.comment;
        else if (string) color = syntaxColors.string;
        else if (keyword) color = syntaxColors.keyword;
        else if (builtin) color = syntaxColors.function;
        else if (number) color = syntaxColors.number;
        else if (operator) color = "#ffb86c";

        tokens.push(React.createElement(Text, { key: match.index, style: { color } }, full));
        lastIndex = regex.lastIndex;
    }

    if (lastIndex < code.length) {
        tokens.push(React.createElement(Text, { key: "last", style: { color: syntaxColors.text } }, code.substring(lastIndex)));
    }

    return tokens;
};

const CodeEditor = ({ value, onChange, style }: { value: string, onChange: (v: string) => void, style?: any }) => {
    const handleTextChange = (text: string) => {
        // Basic Auto-Indent
        if (text.length > value.length && text.endsWith("\n")) {
            const lines = value.split("\n");
            const lastLine = lines[lines.length - 1];
            const indentMatch = lastLine.match(/^(\s*)/);
            if (indentMatch) {
                const indent = indentMatch[1];
                const extraIndent = lastLine.trim().endsWith("{") ? "  " : "";
                onChange(text + indent + extraIndent);
                return;
            }
        }
        onChange(text);
    };

    return React.createElement(View, { style: [styles.editorContainer, style] },
        React.createElement(View, { style: styles.highlighterContainer, pointerEvents: "none" },
            React.createElement(Text, { style: styles.codeText }, highlightJS(value))
        ),
        React.createElement(RNTextInput, {
            style: [styles.codeText, styles.textInputOverlay],
            multiline: true,
            value: value,
            onChangeText: handleTextChange,
            autoCapitalize: "none",
            autoCorrect: false,
            spellCheck: false,
            selectionColor: "rgba(255,255,255,0.3)"
        })
    );
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
     minHeight: 100,
     position: "relative",
     overflow: "hidden"
  },
  highlighterContainer: {
      position: "absolute",
      top: 0, left: 0, right: 0, bottom: 0,
      padding: 12,
  },
  codeText: {
      fontFamily: "monospace",
      fontSize: 13,
      lineHeight: 18,
  },
  textInputOverlay: {
      color: "transparent",
      padding: 12,
      minHeight: 100,
      textAlignVertical: "top",
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
      flexDirection: "row",
      marginBottom: 12,
  },
  snippetTag: {
      backgroundColor: "#313338",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
      marginRight: 8,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
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

function addAutoNote(content: string, notes: AutoNote[], utils: any, channelId: string): Promise<string | null> {
  if (typeof content !== "string") return Promise.resolve(content);
  let matchedSpecific = false;

  const runScript = (note: AutoNote, currentContent: string) => {
    if (!note.script) return Promise.resolve(currentContent);
    try {
      const data = note.data || {};
      const scriptFn = new Function("content", "note", "utils", "storage", note.script);
      return Promise.resolve(scriptFn(currentContent, note, utils, data)).then(result => {
          note.data = data;
          if (result === null) return null;
          return typeof result === "string" ? result : currentContent;
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
            if (note.isRegex) {
                if (!note.trigger) return current;
                triggerRegex = new RegExp(note.trigger, "i");
                match = current.match(triggerRegex);
            } else {
                const escapedTrigger = note.trigger.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                triggerRegex = new RegExp("^\\s*" + escapedTrigger + "(?![\\w])", "i");
                match = current.match(triggerRegex);
            }
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
    if (!Array.isArray(storage.notes)) {
        storage.notes = [{ id: Math.random().toString(36).slice(2), enabled: true, trigger: "@silent", footer: "Sent as {trigger}", removeTrigger: false, style: "subtext", position: "bottom", data: {}, icon: "🥷" }];
    }
    if (!Array.isArray(storage._logs)) storage._logs = [];
}

validateStorage();

const patches = [];

patches.push(instead("sendMessage", MessageActions, (args, orig) => {
    const channelId = args[0];
    const message = args[1];
    if (typeof message?.content !== "string" || message?.__autoNoteProcessed) return orig(...args);
    
    const channel = (InternalChannelStore || ChannelStore)?.getChannel?.(channelId);
    const guild = (InternalGuildStore || GuildStore)?.getGuild?.(channel?.guild_id);
    const user = UserStore?.getCurrentUser?.();

    const afterCallbacks: ((id: string) => void)[] = [];
    const utils = {
        channel: channel?.name || (channel?.type === 1 ? "Direct Message" : "Unknown"),
        channelID: channelId,
        server: guild?.name || (channel?.type === 1 ? "DMs" : "Direct Message"),
        serverID: guild?.id || "0",
        user: user,
        send: (msg: string) => MessageActions.sendMessage(channelId, { content: msg, __autoNoteProcessed: true }),
        delete: (messageId: string) => MessageActions.deleteMessage?.(channelId, messageId),
        edit: (messageId: string, msg: string) => MessageActions.editMessage?.(channelId, messageId, { content: msg }),
        copy: (text: string) => Clipboard?.setString?.(text),
        fetch: (url: string, opts?: any) => fetch(url, opts),
        log: (...args: any[]) => pushLog(args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ")),
        sleep: (ms: number) => new Promise(res => setTimeout(res, ms)),
        stop: () => null,
        webhook: (urlOrData: string | any, data?: any) => {
            const url = typeof urlOrData === "string" ? urlOrData : urlOrData?.url;
            const payload = typeof urlOrData === "string" ? data : urlOrData;
            if (!url) return Promise.reject("No webhook URL provided");
            const body = { content: payload?.content, username: payload?.name || payload?.username, avatar_url: payload?.avatar || payload?.avatar_url };
            if (HTTP?.post) return HTTP.post({ url, body, headers: { "Content-Type": "application/json" } });
            return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        },
        runAfter: (cb: (id: string) => void) => afterCallbacks.push(cb)
    };

    return addAutoNote(message.content, storage.notes, utils, channelId).then(result => {
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
    }).catch(e => orig(...args));
}));

export const onUnload = () => patches.forEach(p => p());

export const settings = () => {
  const [notes, setNotes] = React.useState<AutoNote[]>(() => storage.notes);
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>(() => {
      const initial: Record<string, boolean> = {};
      notes.forEach(n => { initial[n.id] = true; });
      return initial;
  });
  const [selectingStyle, setSelectingStyle] = React.useState<string | null>(null);
  const [modalScript, setModalScript] = React.useState<{id: string, code: string} | null>(null);
  const [showTemplates, setShowTemplates] = React.useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = React.useState<string | null>(null);
  const [logs, setLogs] = React.useState<string[]>(() => storage._logs || []);

  const updateNotes = (newNotes: AutoNote[]) => { storage.notes = newNotes; setNotes([...newNotes]); };
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
  const deleteNote = (id: string) => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); updateNotes(notes.filter(n => n.id !== id)); };
  const updateNote = (id: string, partial: Partial<AutoNote>) => updateNotes(notes.map(n => (n.id === id ? { ...n, ...partial } : n)));

  return React.createElement(ScrollView, { style: { flex: 1 } },
    React.createElement(Stack, { spacing: 8, style: { padding: 10 } },
      notes.map((note, idx) =>
        React.createElement(View, { key: note.id, style: styles.card },
          React.createElement(View, { style: styles.headerRow },
            React.createElement(TouchableOpacity, { onPress: () => toggleCollapsed(note.id), style: { flex: 1, flexDirection: "row", alignItems: "center" } },
                React.createElement(Text, { style: { color: "white", fontWeight: "bold", fontSize: 16 } }, 
                  `${collapsed[note.id] ? "▶" : "▼"} ${note.icon || "📝"} ${note.trigger ? (note.isRegex ? "/" + note.trigger + "/" : "Trigger: " + note.trigger) : "Global Fallback"}`
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
              React.createElement(TableSwitchRow, { label: "Use Regex", value: note.isRegex || false, onValueChange: (v: boolean) => updateNote(note.id, { isRegex: v }) }),
              React.createElement(TextInput, { label: "Note Text", placeholder: "Enter text...", value: note.footer, onChange: (v: string) => updateNote(note.id, { footer: v }), multiline: true }),
              React.createElement(TableRow, { label: "Position", subLabel: (note.position || "bottom").toUpperCase(), onPress: () => updateNote(note.id, { position: (note.position || "bottom") === "top" ? "bottom" : "top" }) }),
              React.createElement(TableRow, { label: "Style", subLabel: (note.style || "none").toUpperCase(), onPress: () => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setSelectingStyle(selectingStyle === note.id ? null : note.id); } }),
              selectingStyle === note.id && React.createElement(View, { style: { paddingLeft: 16, backgroundColor: "rgba(0,0,0,0.1)" } },
                  (["none", "subtext", "blockquote", "code"] as NoteStyle[]).map(s => 
                      React.createElement(TableRow, { key: s, label: s.toUpperCase(), selected: note.style === s, onPress: () => { updateNote(note.id, { style: s }); setSelectingStyle(null); } })
                  )
              ),
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
        )
      ),
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
          React.createElement(TableRow, { label: "Script Context", subLabel: "content, note, storage, utils (send, delete, edit, copy, runAfter, fetch, log, webhook, sleep, stop)" }),
          React.createElement(TableRow, { label: "utils.runAfter(cb)", subLabel: "Runs a callback after the message is sent. Callback receives the message 'id'. Useful for delayed actions like auto-delete." })
      )
    ),

    modalScript && React.createElement(ReactNative.Modal, { visible: true, animationType: "slide" },
        React.createElement(View, { style: styles.modalContent },
            React.createElement(Text, { style: styles.modalHeader }, "Script Editor"),
            React.createElement(ScrollView, { horizontal: true, style: styles.snippetScroll, showsHorizontalScrollIndicator: false },
                SNIPPETS.map(s => React.createElement(TouchableOpacity, { key: s.label, style: styles.snippetTag, onPress: () => setModalScript({ ...modalScript, code: modalScript.code + "\n" + s.code }) },
                    React.createElement(Text, { style: { color: "#eee", fontSize: 12 } }, s.label)
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
                React.createElement(TouchableOpacity, { style: [styles.addButton, { flex: 1, marginBottom: 0, backgroundColor: "#23a55a" }], onPress: () => { updateNote(modalScript.id, { script: modalScript.code }); setModalScript(null); } }, React.createElement(Text, { style: styles.buttonText }, "SAVE")),
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
