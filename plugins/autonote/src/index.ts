import { findByProps } from "@vendetta/metro";
import { React, ReactNative } from "@vendetta/metro/common";
import { after } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";

const { ScrollView, Text, TouchableOpacity, StyleSheet, View } = ReactNative;

// Find message actions
const MessageActions = findByProps("sendMessage", "receiveMessage");

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
    case "subtext":
      return "-# " + text;
    case "blockquote":
      return "> " + text;
    case "code":
      return "`" + text + "`";
    default:
      return text;
  }
}

function processPlaceholders(text: string, triggerMatch: string): string {
  const now = new Date();
  return text
    .replace(/{trigger}/g, triggerMatch)
    .replace(/{time}/g, now.toLocaleTimeString())
    .replace(/{date}/g, now.toLocaleDateString());
}

function addAutoNote(content: string, notes: AutoNote[]): string {
  let newContent = content;
  let matchedSpecific = false;

  // First pass: Process specific triggers
  for (const note of notes) {
    if (!note.enabled || !note.trigger) continue;

    const escapedTrigger = note.trigger.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const triggerRegex = new RegExp("^" + escapedTrigger + "\\b", "i");

    const match = newContent.match(triggerRegex);
    if (!match) continue;

    matchedSpecific = true;
    const matchedText = match[0];

    // Optionally remove the trigger
    if (note.removeTrigger) {
      newContent = newContent.replace(triggerRegex, "").trim();
    }

    // Execute script
    if (note.script) {
      try {
        const scriptFn = new Function("content", "note", note.script);
        const result = scriptFn(newContent, note);
        if (typeof result === "string") newContent = result;
      } catch (e) {
        console.error("[AutoNote] Script error:", e);
      }
    }

    // Process text
    let addedText = processPlaceholders(note.footer, matchedText);
    addedText = applyStyle(addedText, note.style);

    if (note.position === "top") {
      newContent = addedText + "\n" + newContent;
    } else {
      newContent = newContent + "\n" + addedText;
    }
  }

  // Second pass: Process "empty" triggers only if no specific trigger matched
  if (!matchedSpecific) {
    for (const note of notes) {
      if (!note.enabled || note.trigger) continue;

      // Execute script
      if (note.script) {
        try {
          const scriptFn = new Function("content", "note", note.script);
          const result = scriptFn(newContent, note);
          if (typeof result === "string") newContent = result;
        } catch (e) {
          console.error("[AutoNote] Script error:", e);
        }
      }

      // Process text
      let addedText = processPlaceholders(note.footer, "");
      addedText = applyStyle(addedText, note.style);

      if (note.position === "top") {
        newContent = addedText + "\n" + newContent;
      } else {
        newContent = newContent + "\n" + addedText;
      }
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
  },
];

const unpatch = after("sendMessage", MessageActions, (args) => {
  if (args[1]?.content) {
    args[1].content = addAutoNote(args[1].content, storage.notes);
    args[1].nonce = args[1].nonce || Math.random().toString(36).slice(2);
  }
});

export const onUnload = () => unpatch();

export const settings = () => {
  const [notes, setNotes] = React.useState<AutoNote[]>([...storage.notes]);
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});

  const toggleCollapsed = (id: string) => {
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const updateNotes = (newNotes: AutoNote[]) => {
    storage.notes = newNotes;
    setNotes([...newNotes]);
  };

  const addNote = () => {
    const newNote: AutoNote = {
      id: Math.random().toString(36).slice(2),
      enabled: true,
      trigger: "",
      footer: "",
      removeTrigger: false,
      style: "none",
      position: "bottom",
    };
    updateNotes([...notes, newNote]);
  };

  const deleteNote = (id: string) => {
    updateNotes(notes.filter((n) => n.id !== id));
  };

  const updateNote = (id: string, partial: Partial<AutoNote>) => {
    updateNotes(notes.map((n) => (n.id === id ? { ...n, ...partial } : n)));
  };

  if (!TableRowGroup || !TableSwitchRow || !TableRow || !Stack || !TextInput) {
    return React.createElement(ScrollView, { style: { flex: 1, padding: 12 } },
      React.createElement(Text, { style: { color: "white" } }, "AutoNote UI unavailable (missing components).")
    );
  }

  return React.createElement(ScrollView, { style: { flex: 1 } },
    React.createElement(Stack, { spacing: 8, style: { padding: 10 } },
      notes.map((note) =>
        React.createElement(View, { key: note.id, style: styles.card },
          React.createElement(TouchableOpacity, { 
            onPress: () => toggleCollapsed(note.id),
            style: styles.headerRow 
          },
            React.createElement(Text, { style: { color: "white", fontWeight: "bold", fontSize: 16 } }, 
              `${collapsed[note.id] ? "▶" : "▼"} ${note.trigger ? "Trigger: " + note.trigger : "Global Default (Fallback)"}`
            ),
            React.createElement(Text, { style: { color: note.enabled ? "#43b581" : "#f04747", fontSize: 12 } }, 
                note.enabled ? "ACTIVE" : "DISABLED"
            )
          ),
          
          !collapsed[note.id] && React.createElement(View, { style: { marginTop: 10 } },
            React.createElement(TableRowGroup, null,
              React.createElement(TableSwitchRow, {
                label: "Enabled",
                value: note.enabled,
                onValueChange: (v: boolean) => updateNote(note.id, { enabled: v }),
              }),
              React.createElement(TextInput, {
                label: "Trigger Keyword",
                placeholder: "Leave empty for every message...",
                value: note.trigger,
                onChange: (v: string) => updateNote(note.id, { trigger: v }),
              }),
              React.createElement(TextInput, {
                label: "Note Text",
                placeholder: "Enter text...",
                value: note.footer,
                onChange: (v: string) => updateNote(note.id, { footer: v }),
              }),
              React.createElement(TableSwitchRow, {
                label: "Remove trigger from message",
                value: note.removeTrigger,
                onValueChange: (v: boolean) => updateNote(note.id, { removeTrigger: v }),
              }),
              React.createElement(TableRow, {
                label: "Position",
                subLabel: `Currently at: ${note.position.toUpperCase()}`,
                onPress: () => updateNote(note.id, { position: note.position === "top" ? "bottom" : "top" }),
              }),
              React.createElement(TableRow, {
                label: "Style",
                subLabel: `Current: ${note.style.toUpperCase()}`,
                onPress: () => {
                  const styles: NoteStyle[] = ["none", "subtext", "blockquote", "code"];
                  const currentIndex = styles.indexOf(note.style);
                  updateNote(note.id, { style: styles[(currentIndex + 1) % styles.length] });
                },
              }),
              React.createElement(View, { style: { padding: 16 } },
                  React.createElement(Text, { style: { color: "#bbb", marginBottom: 8, fontSize: 12 } }, "Custom Script (JS)"),
                  React.createElement(TextInput, {
                    placeholder: "return content + '...';",
                    multiline: true,
                    value: note.script || "",
                    onChange: (v: string) => updateNote(note.id, { script: v }),
                    style: styles.scriptInput
                  })
              )
            ),
            React.createElement(TouchableOpacity, {
                style: styles.deleteButton,
                onPress: () => deleteNote(note.id),
              },
              React.createElement(Text, { style: styles.buttonText }, "Delete Profile")
            )
          )
        )
      ),
      React.createElement(TouchableOpacity, { style: styles.addButton, onPress: addNote },
        React.createElement(Text, { style: styles.buttonText }, "+ Add New Profile")
      ),
      React.createElement(TableRowGroup, { title: "Info" },
        React.createElement(TableRow, {
          label: "Placeholders",
          subLabel: "{trigger}, {time}, {date}",
          disabled: true,
        }),
        React.createElement(TableRow, {
            label: "Script Context",
            subLabel: "Variables: content (string), note (object). Return new content.",
            disabled: true,
        })
      )
    )
  );
};
