import { React } from "@vendetta/metro/common";
import { Forms, General } from "@vendetta/ui/components";
import { manualOverrides } from "./index";

const { FormRow, FormSection, FormDivider } = Forms;
const { ScrollView, Text, View } = General;

const EXAMPLE_JSON = `{
  "id": "1492630605379145768",
  "content": "example text",
  "author": {
    "username": "User",
    "globalName": "Display Name",
    "avatarDecorationData": { "asset": "asset_id" }
  },
  "reactions": [{ 
    "emoji": { "name": "😭" }, 
    "count": 1 
  }],
  "flags": 0,
  "nick": "Server Nickname"
}`;

export default function SettingPage() {  
    return (
        <ScrollView style={{ flex: 1, padding: 10 }}>
            <FormSection title="Active Overrides">
                {manualOverrides.size === 0 ? (
                    <FormRow label="No active edits" subLabel="Use /edit <id> <path> <value>" />
                ) : (
                    Array.from(manualOverrides.entries()).map(([id, data]) => (
                        <FormRow 
                            key={id}
                            label={`ID: ${id}`}
                            subLabel={`${data.path} ➔ ${data.value}`}
                        />
                    ))
                )}
                {manualOverrides.size > 0 && (
                    <FormRow 
                        label="Clear All Overrides" 
                        onPress={() => manualOverrides.clear()}
                    />
                )}
            </FormSection>

            <FormDivider />

            <FormSection title="Path Examples">
                <FormRow label="Edit Text" subLabel="path: content" />
                <FormRow label="Edit Username" subLabel="path: author/username" />
                <FormRow label="Edit Flags" subLabel="path: flags (e.g. 64 for ephemeral)" />
            </FormSection>

            <FormDivider />

            <FormSection title="Message Structure Reference">
                <View style={{ backgroundColor: "#1e1e1e", padding: 10, borderRadius: 8 }}>
                    <Text style={{ fontFamily: "monospace", color: "#d4d4d4", fontSize: 11 }}>
                        {EXAMPLE_JSON}
                    </Text>
                </View>
            </FormSection>
        </ScrollView>
    );
}
