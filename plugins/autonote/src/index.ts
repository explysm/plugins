import { findByProps } from "@vendetta/metro";
import { React, ReactNative } from "@vendetta/metro/common";
import { after } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";

const { ScrollView, Text, TouchableOpacity, StyleSheet } = ReactNative;

// Find message actions
const MessageActions = findByProps("sendMessage", "receiveMessage");

// UI Components
const TableRowGroup = findByProps("TableRowGroup")?.TableRowGroup;
const TableRow = findByProps("TableRow")?.TableRow;
const TableSwitchRow = findByProps("TableSwitchRow")?.TableSwitchRow;
const Stack = findByProps("Stack")?.Stack;
const TextInput = findByProps("TextInput")?.TextInput;
const Button = findByProps("Button")?.default || findByProps("Button");

type NoteStyle = "none" | "subtext" | "blockquote" | "code";

interface AutoNote {
  id: string;
  enabled: boolean;
  trigger: string;
  footer: string;
  removeTrigger: boolean;
  style: NoteStyle;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  deleteButton: {
    backgroundColor: "#ed4245",
    padding: 8,
    borderRadius: 4,
    alignItems: "center",
    marginTop: 8,
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

  for (const note of notes) {
    if (!note.enabled || !note.trigger) continue;

    const escapedTrigger = note.trigger.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const triggerRegex = new RegExp("^" + escapedTrigger + "\\b", "i");

    const match = newContent.match(triggerRegex);
    if (!match) continue;

    const matchedText = match[0];

    // Optionally remove the trigger
    if (note.removeTrigger) {
      newContent = newContent.replace(triggerRegex, "").trim();
    }

    // Process footer
    let footer = processPlaceholders(note.footer, matchedText);
    footer = applyStyle(footer, note.style);

    // Add AutoNote footer
    newContent += "\n" + footer;
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
    };
    updateNotes([...notes, newNote]);
  };

  const deleteNote = (id: string) => {
    updateNotes(notes.filter((n) => n.id !== id));
  };

  const updateNote = (id: string, partial: Partial<AutoNote>) => {
    updateNotes(notes.map((n) => (n.id === id ? { ...n, ...partial } : n)));
  };

  // Fallback if components are missing
  if (!TableRowGroup || !TableSwitchRow || !TableRow || !Stack || !TextInput) {
    return React.createElement(
      ScrollView,
      { style: { flex: 1, padding: 12 } },
      React.createElement(
        Text,
        { style: { color: "white" } },
        "AutoNote UI unavailable (missing components).",
      ),
    );
  }

  return React.createElement(
    ScrollView,
    { style: { flex: 1 } },
    React.createElement(
      Stack,
      { spacing: 8, style: { padding: 10 } },
      notes.map((note) =>
        React.createElement(
          ReactNative.View,
          { key: note.id, style: styles.card },
          React.createElement(
            TableRowGroup,
            { title: `Note: ${note.trigger || "(no trigger)"}` },
            React.createElement(TableSwitchRow, {
              label: "Enabled",
              value: note.enabled,
              onValueChange: (v: boolean) => updateNote(note.id, { enabled: v }),
            }),
            React.createElement(TextInput, {
              label: "Trigger Keyword",
              placeholder: "@silent",
              value: note.trigger,
              onChange: (v: string) => updateNote(note.id, { trigger: v }),
            }),
            React.createElement(TextInput, {
              label: "Footer Text",
              placeholder: "Enter footer text...",
              value: note.footer,
              onChange: (v: string) => updateNote(note.id, { footer: v }),
            }),
            React.createElement(TableSwitchRow, {
              label: "Remove trigger from message",
              value: note.removeTrigger,
              onValueChange: (v: boolean) =>
                updateNote(note.id, { removeTrigger: v }),
            }),
            React.createElement(TableRow, {
              label: "Style",
              subLabel: `Current: ${note.style}`,
              onPress: () => {
                const styles: NoteStyle[] = [
                  "none",
                  "subtext",
                  "blockquote",
                  "code",
                ];
                const currentIndex = styles.indexOf(note.style);
                const nextIndex = (currentIndex + 1) % styles.length;
                updateNote(note.id, { style: styles[nextIndex] });
              },
            }),
          ),
          React.createElement(
            TouchableOpacity,
            {
              style: styles.deleteButton,
              onPress: () => deleteNote(note.id),
            },
            React.createElement(Text, { style: styles.buttonText }, "Delete Note"),
          ),
        ),
      ),
      React.createElement(
        TouchableOpacity,
        { style: styles.addButton, onPress: addNote },
        React.createElement(Text, { style: styles.buttonText }, "+ Add New Note"),
      ),
      React.createElement(
        TableRowGroup,
        { title: "Info" },
        React.createElement(TableRow, {
          label: "Placeholders",
          subLabel: "{trigger}, {time}, {date}",
          disabled: true,
        }),
      ),
    ),
  );
};
