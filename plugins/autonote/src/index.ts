import { findByProps } from "@vendetta/metro";
import { React, ReactNative } from "@vendetta/metro/common";
import { after, before, instead } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";

const { ScrollView, Text, TouchableOpacity, StyleSheet, View } = ReactNative;

// Find internal modules
const MessageActions = findByProps("sendMessage", "receiveMessage");
const Clipboard = findByProps("setString", "getString");

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
    .then(data => content + "\\n\\n> " + data.content + " — " + data.author);`
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  deleteButton: {
    backgroundColor: "#ed4245",
    padding: 8,
    borderRadius: 4,
    alignItems: "center",
    marginTop: 12,
  },
  addButton: {
    backgroundColor: "#5865f2",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 20,
  },
  secondaryButton: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    padding: 8,
    borderRadius: 4,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
  },
  scriptInput: {
     fontFamily: "monospace",
     fontSize: 12,
     backgroundColor: "rgba(0,0,0,0.2)",
     borderRadius: 4,
     padding: 8,
     color: "#ccc",
  },
  modalContent: {
    flex: 1,
    backgroundColor: "#2c2f33",
    padding: 20,
  },
  modalHeader: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
    marginBottom: 10,
  }
});

function applyStyle(text: string, style: NoteStyle): string {
  switch (style) {
    case "subtext": return "-# " + text;
    case "blockquote": return "> " + text;
    case "code": return "`" + text + "`";
    default: return text;
  }
}

function processPlaceholders(text: string, triggerMatch: string, content: string): Promise<string> {
  const now = new Date();
  let result = text
    .replace(/{trigger}/g, triggerMatch)
    .replace(/{time}/g, now.toLocaleTimeString())
    .replace(/{date}/g, now.toLocaleDateString())
    .replace(/{wordCount}/g, content.split(/\s+/).filter(Boolean).length.toString());

  // Handle {random:A,B,C}
  result = result.replace(/{random:([^}]+)}/g, (_, options) => {
    const choices = options.split(",").map((s: string) => s.trim());
    return choices[Math.floor(Math.random() * choices.length)];
  });

  // Handle {clipboard}
  const handleClipboard = (resText: string): Promise<string> => {
      if (resText.includes("{clipboard}")) {
          return Promise.resolve(Clipboard?.getString?.() || "").then(clip => {
              return resText.replace(/{clipboard}/g, clip);
          });
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
                  return current.replace(match, textRes.slice(0, 500));
              }).catch(e => {
                  console.error("[AutoNote] API fetch failed:", e);
                  return current;
              });
          });
      });
      return p;
  };

  return handleClipboard(result).then(handleAPI);
}

function isScoped(note: AutoNote, channelId: string): boolean {
    if (note.whitelist) {
        const ids = note.whitelist.split(",").map(s => s.trim()).filter(Boolean);
        if (ids.length > 0 && !ids.includes(channelId)) return false;
    }
    if (note.blacklist) {
        const ids = note.blacklist.split(",").map(s => s.trim()).filter(Boolean);
        if (ids.length > 0 && ids.includes(channelId)) return false;
    }
    return true;
}

function addAutoNote(content: string, notes: AutoNote[], utils: any, channelId: string): Promise<string | null> {
  let newContent = content;
  let matchedSpecific = false;

  const runScript = (note: AutoNote, currentContent: string) => {
    if (!note.script) return Promise.resolve(currentContent);
    try {
      note.data ??= {};
      // Wrap script in a function that returns the result, possibly as a Promise
      const scriptFn = new Function("content", "note", "utils", "storage", note.script);
      return Promise.resolve(scriptFn(currentContent, note, utils, note.data)).then(result => {
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

  const safeNotes = Array.isArray(notes) ? notes : [];
  let p = Promise.resolve(newContent as string | null);

  for (const note of safeNotes) {
    p = p.then(current => {
        if (current === null || !note.enabled || !note.trigger || !isScoped(note, channelId)) return current;
        
        let match: RegExpMatchArray | null = null;
        let triggerRegex: RegExp;

        if (note.isRegex) {
            try {
                triggerRegex = new RegExp(note.trigger, "i");
                match = current.match(triggerRegex);
            } catch(e) { console.error("[AutoNote] Invalid regex:", e); return current; }
        } else {
            const escapedTrigger = note.trigger.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            // Support triggers that end in punctuation and allow optional leading whitespace
            triggerRegex = new RegExp("^\\s*" + escapedTrigger + "(?![\\w])", "i");
            match = current.match(triggerRegex);
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
            return processPlaceholders(note.footer || "", matchedText, scriptResult).then(addedText => {
                const position = note.position || "bottom";
                const styledText = applyStyle(addedText, note.style || "none");
                return position === "top" ? styledText + "\n" + scriptResult : scriptResult + "\n" + styledText;
            });
        });
    });
  }

  p = p.then(current => {
      if (current === null || matchedSpecific) return current;
      
      let pFallback = Promise.resolve(current as string | null);
      for (const note of safeNotes) {
        pFallback = pFallback.then(curr => {
            if (curr === null || !note.enabled || note.trigger || !isScoped(note, channelId)) return curr;
            return runScript(note, curr).then(scriptResult => {
                if (scriptResult === null) return null;
                return processPlaceholders(note.footer || "", "", scriptResult).then(addedText => {
                    const position = note.position || "bottom";
                    const styledText = applyStyle(addedText, note.style || "none");
                    return position === "top" ? styledText + "\n" + scriptResult : scriptResult + "\n" + styledText;
                });
            });
        });
      }
      return pFallback;
  });

  return p;
}

// Default settings
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
}

const patches = [];

// Use INSTEAD to allow true cancellation
patches.push(instead("sendMessage", MessageActions, (args, orig) => {
    const channelId = args[0];
    const message = args[1];
    
    if (typeof message?.content !== "string" || message?.__autoNoteProcessed) {
        return orig(...args);
    }
    
    const afterCallbacks: ((id: string) => void)[] = [];
    const utils = {
        send: (msg: string) => MessageActions.sendMessage(channelId, { content: msg, __autoNoteProcessed: true }),
        delete: (messageId: string) => MessageActions.deleteMessage?.(channelId, messageId),
        edit: (messageId: string, msg: string) => MessageActions.editMessage?.(channelId, messageId, { content: msg }),
        copy: (text: string) => Clipboard?.setString?.(text),
        fetch: (url: string, opts?: any) => fetch(url, opts),
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
    });
}));

export const onUnload = () => patches.forEach(p => p());

export const settings = () => {
  const [notes, setNotes] = React.useState<AutoNote[]>(() => {
      const currentNotes = Array.isArray(storage.notes) ? [...storage.notes] : [];
      let changed = false;
      currentNotes.forEach(n => {
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
              React.createElement(Text, { style: styles.buttonText }, "Delete Profile")
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
        React.createElement(TableRow, { label: "Placeholders", subLabel: "{trigger}, {time}, {date}, {wordCount}, {clipboard}, {random:A,B}, {api:url}", disabled: true }),
        React.createElement(TableRow, {
            label: "Script Context",
            subLabel: "content, note, storage, utils (send, delete, edit, copy, runAfter, fetch). Return null to cancel.",
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
