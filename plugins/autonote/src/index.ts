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
}

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

function processPlaceholders(text: string, triggerMatch: string): string {
  const now = new Date();
  return text
    .replace(/{trigger}/g, triggerMatch)
    .replace(/{time}/g, now.toLocaleTimeString())
    .replace(/{date}/g, now.toLocaleDateString());
}

function addAutoNote(content: string, notes: AutoNote[], utils: any): string | null {
  let newContent = content;
  let matchedSpecific = false;

  const runScript = (note: AutoNote, currentContent: string) => {
    if (!note.script) return currentContent;
    try {
      note.data ??= {};
      const scriptFn = new Function("content", "note", "utils", "storage", note.script);
      const result = scriptFn(currentContent, note, utils, note.data);
      if (result === null) return null;
      return typeof result === "string" ? result : currentContent;
    } catch (e) {
      console.error("[AutoNote] Script error:", e);
      return currentContent;
    }
  };

  for (const note of notes) {
    if (!note.enabled || !note.trigger) continue;
    const escapedTrigger = note.trigger.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const triggerRegex = new RegExp("^" + escapedTrigger + "\\b", "i");
    const match = newContent.match(triggerRegex);
    if (!match) continue;

    matchedSpecific = true;
    const matchedText = match[0];
    if (note.removeTrigger) {
      newContent = newContent.replace(triggerRegex, "").trim();
    }

    const scriptResult = runScript(note, newContent);
    if (scriptResult === null) return null;
    newContent = scriptResult;

    let addedText = processPlaceholders(note.footer || "", matchedText);
    addedText = applyStyle(addedText, note.style || "none");
    const position = note.position || "bottom";
    newContent = position === "top" ? addedText + "\n" + newContent : newContent + "\n" + addedText;
  }

  if (!matchedSpecific) {
    for (const note of notes) {
      if (!note.enabled || note.trigger) continue;
      const scriptResult = runScript(note, newContent);
      if (scriptResult === null) return null;
      newContent = scriptResult;

      let addedText = processPlaceholders(note.footer || "", "");
      addedText = applyStyle(addedText, note.style || "none");
      const position = note.position || "bottom";
      newContent = position === "top" ? addedText + "\n" + newContent : newContent + "\n" + addedText;
    }
  }

  return newContent;
}

// Default settings
storage.notes ??= [
  {
    id: Math.random().toString(36).slice(2),
    enabled: true,
    trigger: "@silent",
    footer: "This was sent as a {trigger} message to avoid annoyance",
    removeTrigger: false,
    style: "subtext",
    position: "bottom",
    data: {}
  },
];

const patches = [];

// Use INSTEAD to allow true cancellation by not calling orig
patches.push(instead("sendMessage", MessageActions, (args, orig) => {
    const channelId = args[0];
    const message = args[1];
    
    if (message?.__autoNoteProcessed) return orig(...args);
    
    if (message?.content) {
        const afterCallbacks: ((id: string) => void)[] = [];
        const utils = {
            send: (msg: string) => MessageActions.sendMessage(channelId, { content: msg, __autoNoteProcessed: true }),
            delete: (messageId: string) => MessageActions.deleteMessage?.(channelId, messageId),
            edit: (messageId: string, msg: string) => MessageActions.editMessage?.(channelId, messageId, { content: msg }),
            sendClyde: (text: string) => MessageActions.sendClydeError?.(channelId, text),
            copy: (text: string) => Clipboard?.setString?.(text),
            runAfter: (cb: (id: string) => void) => afterCallbacks.push(cb)
        };

        const result = addAutoNote(message.content, storage.notes, utils);
        
        if (result === null) {
            console.log("[AutoNote] Message send blocked by script.");
            return Promise.resolve();
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
    }
    return orig(...args);
}));

export const onUnload = () => patches.forEach(p => p());

export const settings = () => {
  const [notes, setNotes] = React.useState<AutoNote[]>(() => {
      const currentNotes = [...(storage.notes || [])];
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
      (storage.notes || []).forEach((n: any) => { initial[n.id] = true; });
      return initial;
  });
  const [selectingStyle, setSelectingStyle] = React.useState<string | null>(null);

  const toggleCollapsed = (id: string) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleSelectingStyle = (id: string) => setSelectingStyle(prev => (prev === id ? null : id));
  const updateNotes = (newNotes: AutoNote[]) => { storage.notes = newNotes; setNotes([...newNotes]); };

  const addNote = () => {
    const newNote: AutoNote = {
      id: Math.random().toString(36).slice(2),
      enabled: true, trigger: "", footer: "", removeTrigger: false, style: "none", position: "bottom", data: {}
    };
    updateNotes([...notes, newNote]);
  };

  const deleteNote = (id: string) => updateNotes(notes.filter((n) => n.id !== id));
  const updateNote = (id: string, partial: Partial<AutoNote>) => updateNotes(notes.map((n) => (n.id === id ? { ...n, ...partial } : n)));

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
              `${collapsed[note.id] ? "▶" : "▼"} ${note.trigger ? "Trigger: " + note.trigger : "Global Default (Fallback)"}`
            ),
            React.createElement(Text, { style: { color: note.enabled ? "#43b581" : "#f04747", fontSize: 12 } }, 
                note.enabled ? "ACTIVE" : "DISABLED"
            )
          ),
          
          !collapsed[note.id] && React.createElement(View, { style: { marginTop: 10 } },
            React.createElement(TableRowGroup, null,
              React.createElement(TableSwitchRow, { label: "Enabled", value: note.enabled, onValueChange: (v: boolean) => updateNote(note.id, { enabled: v }) }),
              React.createElement(TextInput, { label: "Trigger Keyword", placeholder: "Leave empty for every message...", value: note.trigger, onChange: (v: string) => updateNote(note.id, { trigger: v }) }),
              React.createElement(TextInput, { label: "Note Text", placeholder: "Enter text...", value: note.footer, onChange: (v: string) => updateNote(note.id, { footer: v }) }),
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
                  })
              )
            ),
            React.createElement(TouchableOpacity, { style: styles.deleteButton, onPress: () => deleteNote(note.id) },
              React.createElement(Text, { style: styles.buttonText }, "Delete Profile")
            )
          )
        )
      ),
      React.createElement(TouchableOpacity, { style: styles.addButton, onPress: addNote },
        React.createElement(Text, { style: styles.buttonText }, "+ Add New Profile")
      ),
      React.createElement(TableRowGroup, { title: "Info" },
        React.createElement(TableRow, { label: "Placeholders", subLabel: "{trigger}, {time}, {date}", disabled: true }),
        React.createElement(TableRow, {
            label: "Script Context",
            subLabel: "content, note, storage, utils (send, delete, edit, sendClyde, copy, runAfter).",
            disabled: true,
        })
      )
    )
  );
};
