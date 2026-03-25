import { defineCorePlugin } from "..";
import { findByProps } from "@metro";
import { after } from "@lib/api/patcher";
import { logger } from "@lib/utils/logger";
import { settings } from "@lib/api/settings";
import { React } from "@metro/common";

const { TableRowGroup, TableRow, TableSwitchRow, Stack } = findByProps(
  "TableRowGroup",
  "TableRow",
  "TableSwitchRow",
  "Stack",
);
const { ScrollView, Text } = require("react-native");

type AutoNoteSettings = {
  autoNote: boolean;
};

declare module "@lib/api/settings" {
  interface Settings {
    autonote?: AutoNoteSettings;
  }
}

const MessageActions = findByProps("sendMessage");
let unpatch: (() => void) | null = null;

function addAutoNote(content: string, config: AutoNoteSettings): string {
  if (!config.autoNote) return content;
  
  // Check if message starts with @silent
  const isSilent = /@silent\b/i.test(content);
  if (!isSilent) return content;
  
  // Add AutoNote footer while keeping @silent
  content += "\n-# This was sent as a @silent message to avoid annoyance";
  
  return content;
}

export default defineCorePlugin({
  manifest: {
    id: "bunny.autonote",
    version: "1.0.0",
    type: "plugin",
    spec: 3,
    main: "",
    display: {
      name: "AutoNote",
      description:
        "Automatically adds a note to @silent messages explaining they were sent to avoid annoyance.",
      authors: [{ name: "explysm" }],
    },
  },

  SettingsComponent() {
    const { useState, useEffect } = React;
    const [config, setConfig] = useState<AutoNoteSettings>({
      autoNote: settings.autonote?.autoNote ?? true,
    });

    useEffect(() => {
      settings.autonote = config;
    }, [config]);

    const updateConfig = (key: keyof AutoNoteSettings, value: boolean) => {
      setConfig((prev) => ({ ...prev, [key]: value }));
    };

    // Prefer table-style rows (TableRowGroup / TableSwitchRow) and Stack layout similar to other core plugins.
    const {
      TableRowGroup: _TRG,
      TableRow: _TR,
      TableSwitchRow: _TSR,
      Stack: _S,
    } = findByProps("TableRowGroup", "TableRow", "TableSwitchRow", "Stack");

    // Fallback if the table-style components are not available in the host environment
    if (!_TRG || !_TSR || !_TR || !_S) {
      return React.createElement(
        ScrollView,
        { style: { flex: 1, padding: 12 } },
        React.createElement(
          Text,
          null,
          "AutoNote UI unavailable (missing TableRow components).",
        ),
      );
    }

    // Use the resolved components
    const TableRowGroup = _TRG;
    const TableRow = _TR;
    const TableSwitchRow = _TSR;
    const Stack = _S;

    return React.createElement(ScrollView, { style: { flex: 1 } }, [
      React.createElement(
        Stack,
        { spacing: 8, style: { padding: 10 } },

        React.createElement(
          TableRowGroup,
          { title: "Settings" },
          React.createElement(TableSwitchRow, {
            label: "Enable AutoNote",
            value: config.autoNote,
            onValueChange: (v: boolean) => updateConfig("autoNote", v),
          }),
          React.createElement(TableRow, {
            label: "Description",
            subLabel:
              "Automatically adds a note to @silent messages explaining they were sent to avoid annoyance.",
            disabled: true,
          }),
        ),
      ),
    ]);
  },

  start() {
    logger.log("AutoNote: Starting plugin");
    settings.autonote = settings.autonote || {
      autoNote: true,
    };

    if (!unpatch) {
      unpatch = after("sendMessage", MessageActions, (args) => {
        const config = settings.autonote!;
        if (args[1]?.content) {
          args[1].content = addAutoNote(args[1].content, config);
          args[1].nonce = args[1].nonce || Math.random().toString(36).slice(2);
        }
      });
    }
    logger.log("AutoNote: Patched outgoing messages");
  },

  stop() {
    logger.log("AutoNote: Stopping plugin");
    if (unpatch) {
      unpatch();
      unpatch = null;
    }
    logger.log("AutoNote: Unpatched outgoing messages");
  },
});

