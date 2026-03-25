import { findByProps } from "@vendetta/metro";
import { React, ReactNative } from "@vendetta/metro/common";
import { after } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";

const { ScrollView, Text } = ReactNative;

// Find message actions
const MessageActions = findByProps("sendMessage", "receiveMessage");

// UI Components
const TableRowGroup = findByProps("TableRowGroup")?.TableRowGroup;
const TableRow = findByProps("TableRow")?.TableRow;
const TableSwitchRow = findByProps("TableSwitchRow")?.TableSwitchRow;
const Stack = findByProps("Stack")?.Stack;

function addAutoNote(content: string, autoNoteEnabled: boolean): string {
  if (!autoNoteEnabled) return content;
  
  // Check if message starts with @silent
  const isSilent = /@silent\b/i.test(content);
  if (!isSilent) return content;
  
  // Add AutoNote footer while keeping @silent
  content += "\n-# This was sent as a @silent message to avoid annoyance";
  
  return content;
}

// Default settings
storage.autoNote ??= true;

const unpatch = after("sendMessage", MessageActions, (args) => {
  if (args[1]?.content) {
    args[1].content = addAutoNote(args[1].content, storage.autoNote);
    args[1].nonce = args[1].nonce || Math.random().toString(36).slice(2);
  }
});

export const onUnload = () => unpatch();

export const settings = () => {
  const [autoNote, setAutoNote] = React.useState(storage.autoNote);

  // Fallback if components are missing
  if (!TableRowGroup || !TableSwitchRow || !TableRow || !Stack) {
     return React.createElement(ScrollView, { style: { flex: 1, padding: 12 } },
        React.createElement(Text, { style: { color: "white" } }, "AutoNote UI unavailable (missing TableRow components).")
     );
  }

  return React.createElement(ScrollView, { style: { flex: 1 } },
    React.createElement(Stack, { spacing: 8, style: { padding: 10 } },
      React.createElement(TableRowGroup, { title: "Settings" },
        React.createElement(TableSwitchRow, {
          label: "Enable AutoNote",
          value: autoNote,
          onValueChange: (v: boolean) => {
            storage.autoNote = v;
            setAutoNote(v);
          },
        }),
        React.createElement(TableRow, {
          label: "Description",
          subLabel: "Automatically adds a note to @silent messages explaining they were sent to avoid annoyance.",
          disabled: true,
        })
      )
    )
  );
};
