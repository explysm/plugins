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
    "avatar": "url"
  }
}`;

export default function SettingPage() {  
    const overrideEntries = Array.from(manualOverrides.entries());

    return (
        <ScrollView style={{ flex: 1, padding: 10 }}>
            <FormSection title="Active Overrides">
                {overrideEntries.length === 0 ? (
                    <FormRow label="No active edits" subLabel="Use /edit <subcommand> ..." />
                ) : (
                    overrideEntries.map(([id, paths]) => (
                        <View key={id} style={{ marginBottom: 10 }}>
                            <FormRow 
                                label={`Message ID: ${id}`}
                                subLabel={`${paths.size} override(s)`}
                                onPress={() => {
                                    manualOverrides.delete(id);
                                    // React won't auto-refresh Map changes, but Vendetta settings usually do on re-render
                                }}
                            />
                            {Array.from(paths.entries()).map(([path, value]) => (
                                <View key={path} style={{ paddingLeft: 20 }}>
                                    <Text style={{ color: "#ccc", fontSize: 12 }}>
                                        {path} ➔ {String(value)}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    ))
                )}
                {overrideEntries.length > 0 && (
                    <FormRow 
                        label="Clear All Overrides" 
                        onPress={() => manualOverrides.clear()}
                    />
                )}
            </FormSection>

            <FormDivider />

            <FormSection title="Command Help">
                <FormRow label="/edit manual <id> <path> <value>" subLabel="Direct JSON path edit" />
                <FormRow label="/edit name <id> <value>" subLabel="Changes username & global name" />
                <FormRow label="/edit content <id> <value>" subLabel="Changes message text" />
                <FormRow label="/edit avatar <id> <id/url>" subLabel="Changes pfp (supports user IDs)" />
                <FormRow label="/edit clear [id]" subLabel="Remove overrides" />
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
