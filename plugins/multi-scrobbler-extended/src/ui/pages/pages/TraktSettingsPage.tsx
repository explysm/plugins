import { React, ReactNative as RN } from "@vendetta/metro/common";
import { useProxy } from "@vendetta/storage";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";
import {
  ScrollView,
  Stack,
  TableRowGroup,
  TableRow,
  TextInput,
} from "./components/TableComponents";
import { plugin } from "@vendetta";
import { serviceFactory, getStorage, setStorage } from "../Settings";

const { Linking } = RN;

export default function TraktSettingsPage() {
  useProxy(plugin.storage);
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  const testConnection = async () => {
    showToast("Testing Trakt connection...", getAssetIDByName("ClockIcon"));
    try {
      const isValid = await serviceFactory.testService("trakt");
      if (isValid) {
        showToast(
          "✅ Trakt connection successful!",
          getAssetIDByName("CheckIcon"),
        );
      } else {
        showToast("❌ Trakt connection failed", getAssetIDByName("XIcon"));
      }
    } catch (error) {
      showToast("❌ Connection error", getAssetIDByName("XIcon"));
    }
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 10 }}>
      <Stack spacing={8}>
        <TableRowGroup title="Credentials">
          <Stack spacing={4}>
            <TextInput
              placeholder="Trakt Username"
              value={getStorage("traktUsername")}
              onChange={(v: string) => {
                setStorage("traktUsername", v);
                forceUpdate();
              }}
              isClearable
            />
            <TextInput
              placeholder="Trakt Client ID"
              value={getStorage("traktClientId")}
              onChange={(v: string) => {
                setStorage("traktClientId", v);
                forceUpdate();
              }}
              isClearable
            />
            <TextInput
              placeholder="Trakt Access Token (Optional for public profiles)"
              value={getStorage("traktAccessToken")}
              onChange={(v: string) => {
                setStorage("traktAccessToken", v);
                forceUpdate();
              }}
              secureTextEntry={true}
              isClearable
            />
          </Stack>
        </TableRowGroup>

        <TableRowGroup title="Actions">
          <TableRow
            label="Test Connection"
            subLabel="Verify your Trakt credentials"
            trailing={<TableRow.Arrow />}
            onPress={testConnection}
          />
          <TableRow
            label="Get API Credentials"
            subLabel="Create a Trakt API app at trakt.tv/oauth/applications"
            trailing={<TableRow.Arrow />}
            onPress={async () => {
              try {
                await Linking.openURL("https://trakt.tv/oauth/applications");
              } catch (error) {
                console.error("Failed to open Trakt API URL:", error);
                showToast(
                  "Failed to open web browser. Please visit: https://trakt.tv/oauth/applications",
                  getAssetIDByName("XIcon"),
                );
              }
            }}
          />
        </TableRowGroup>
      </Stack>
    </ScrollView>
  );
}
