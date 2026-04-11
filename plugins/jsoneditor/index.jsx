import { commands } from "@vendetta";
import { FluxDispatcher } from "@vendetta/metro/common";
import { findByProps } from "@vendetta/metro";
import fluxDispatchPatch from "./patches/flux_dispatch";
import SettingPage from "./Settings";

export let isEnabled = false;
// Structure: Map<messageId, Map<path, value>>
export const manualOverrides = new Map();

const SelectedChannelStore = findByProps("getChannelId");
const UserStore = findByProps("getUser", "getUsers");

export const setDeepValue = (obj, path, value) => {
    if (!obj || typeof obj !== 'object') return;
    const keys = path.split('/');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!current[key] || typeof current[key] !== 'object') {
            current[key] = {};
        }
        current = current[key];
    }
    
    const lastKey = keys[keys.length - 1];
    let finalValue = value;
    
    if (value === "true") {
        finalValue = true;
    } else if (value === "false") {
        finalValue = false;
    } else if (typeof value === "string" && !isNaN(value) && value.trim() !== "") {
        if (value.length < 16) {
            finalValue = Number(value);
        }
    }
    
    current[lastKey] = finalValue;
};

const addOverride = (id, path, value) => {
    if (!manualOverrides.has(id)) {
        manualOverrides.set(id, new Map());
    }
    manualOverrides.get(id).set(path, value);
};

let unpatch;
export default {
    onLoad: () => {
        unpatch = fluxDispatchPatch();
        isEnabled = true;
        commands.registerCommand({
            name: "edit",
            description: "Manually edit message JSON",
            options: [
                {
                    name: "manual",
                    description: "Edit any JSON path",
                    type: 1,
                    options: [
                        { name: "id", description: "Message ID", type: 3, required: true },
                        { name: "path", description: "Path (e.g. author/username)", type: 3, required: true },
                        { name: "value", description: "New value", type: 3, required: true }
                    ]
                },
                {
                    name: "name",
                    description: "Preset: Change author name",
                    type: 1,
                    options: [
                        { name: "id", description: "Message ID", type: 3, required: true },
                        { name: "value", description: "New name", type: 3, required: true }
                    ]
                },
                {
                    name: "content",
                    description: "Preset: Change message content",
                    type: 1,
                    options: [
                        { name: "id", description: "Message ID", type: 3, required: true },
                        { name: "value", description: "New content", type: 3, required: true }
                    ]
                },
                {
                    name: "avatar",
                    description: "Preset: Change author avatar",
                    type: 1,
                    options: [
                        { name: "id", description: "Message ID", type: 3, required: true },
                        { name: "value", description: "Avatar URL or User ID", type: 3, required: true }
                    ]
                },
                {
                    name: "clear",
                    description: "Clear overrides for a message",
                    type: 1,
                    options: [
                        { name: "id", description: "Message ID (omit to clear all)", type: 3, required: false }
                    ]
                }
            ],
            execute: (args) => {
                const subcommand = args[0];
                const getArg = (name) => subcommand.options.find(a => a.name === name)?.value;
                const id = getArg("id");
                const value = getArg("value");

                if (subcommand.name === "clear") {
                    if (id) manualOverrides.delete(id);
                    else manualOverrides.clear();
                } else if (id) {
                    if (subcommand.name === "manual") {
                        addOverride(id, getArg("path"), value);
                    } else if (subcommand.name === "name") {
                        addOverride(id, "author/username", value);
                        addOverride(id, "author/globalName", value);
                    } else if (subcommand.name === "content") {
                        addOverride(id, "content", value);
                    } else if (subcommand.name === "avatar") {
                        let avatarUrl = value;
                        if (!value.startsWith("http")) {
                            const user = UserStore.getUser(value);
                            if (user) avatarUrl = user.getAvatarURL?.();
                        }
                        addOverride(id, "author/avatar", avatarUrl);
                    }

                    // Trigger refresh
                    FluxDispatcher.dispatch({
                        type: "MESSAGE_UPDATE",
                        message: { 
                            id: id,
                            channel_id: SelectedChannelStore?.getChannelId?.()
                        },
                        otherPluginBypass: false
                    });
                }
            }
        });
    },
    onUnload: () => {
        isEnabled = false;
        unpatch?.();
    },
    settings: SettingPage
}
