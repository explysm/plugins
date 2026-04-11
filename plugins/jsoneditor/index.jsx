import { commands } from "@vendetta";
import { FluxDispatcher } from "@vendetta/metro/common";
import { findByProps } from "@vendetta/metro";
import fluxDispatchPatch from "./patches/flux_dispatch";
import SettingPage from "./Settings";

export let isEnabled = false;
export const manualOverrides = new Map();

const SelectedChannelStore = findByProps("getChannelId");
const UserStore = findByProps("getUser", "getUsers");
const MessageStore = findByProps("getMessage", "getMessages");

export const setDeepValue = (obj, path, value) => {
    if (!obj || typeof obj !== 'object') return;
    const keys = path.split('/');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!current[key] || typeof current[key] !== 'object') {
            current[key] = {};
        } else {
            current[key] = Array.isArray(current[key]) ? [...current[key]] : { ...current[key] };
        }
        current = current[key];
    }
    
    const lastKey = keys[keys.length - 1];
    let finalValue = value;
    
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed === "true") {
            finalValue = true;
        } else if (trimmed === "false") {
            finalValue = false;
        } else if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
            try {
                finalValue = JSON.parse(trimmed);
            } catch (e) {
                // Fallback to string if JSON is invalid
            }
        } else if (!isNaN(trimmed) && trimmed !== "") {
            if (trimmed.length < 16) {
                finalValue = Number(trimmed);
            }
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

const refreshMessage = (id) => {
    const channelId = SelectedChannelStore?.getChannelId?.();
    const existing = MessageStore?.getMessage?.(channelId, id);
    
    FluxDispatcher.dispatch({
        type: "MESSAGE_UPDATE",
        message: { 
            ...(existing || {}),
            id: id,
            channel_id: channelId
        },
        otherPluginBypass: false
    });
};

let unpatches = [];

export default {
    onLoad: () => {
        unpatches.push(fluxDispatchPatch());
        isEnabled = true;

        unpatches.push(commands.registerCommand({
            name: "edit",
            description: "Manually edit message JSON path",
            options: [
                { name: "id", description: "Message ID", type: 3, required: true },
                { name: "path", description: "Path (e.g. author/username)", type: 3, required: true },
                { name: "value", description: "New value", type: 3, required: true }
            ],
            execute: (args) => {
                const get = (n) => args.find(a => a.name === n)?.value;
                const id = get("id");
                if (id) {
                    addOverride(id, get("path"), get("value"));
                    refreshMessage(id);
                }
            }
        }));

        unpatches.push(commands.registerCommand({
            name: "editname",
            description: "Preset: Change message author name",
            options: [
                { name: "id", description: "Message ID", type: 3, required: true },
                { name: "value", description: "New name", type: 3, required: true }
            ],
            execute: (args) => {
                const get = (n) => args.find(a => a.name === n)?.value;
                const id = get("id");
                const val = get("value");
                if (id) {
                    addOverride(id, "author/username", val);
                    addOverride(id, "author/globalName", val);
                    refreshMessage(id);
                }
            }
        }));

        unpatches.push(commands.registerCommand({
            name: "editcontent",
            description: "Preset: Change message content",
            options: [
                { name: "id", description: "Message ID", type: 3, required: true },
                { name: "value", description: "New content", type: 3, required: true }
            ],
            execute: (args) => {
                const get = (n) => args.find(a => a.name === n)?.value;
                const id = get("id");
                if (id) {
                    addOverride(id, "content", get("value"));
                    refreshMessage(id);
                }
            }
        }));

        unpatches.push(commands.registerCommand({
            name: "editavatar",
            description: "Preset: Change message author avatar",
            options: [
                { name: "id", description: "Message ID", type: 3, required: true },
                { name: "value", description: "Avatar URL or User ID", type: 3, required: true }
            ],
            execute: (args) => {
                const get = (n) => args.find(a => a.name === n)?.value;
                const id = get("id");
                const val = get("value");
                if (id) {
                    let avatarUrl = val;
                    if (!val.startsWith("http")) {
                        const user = UserStore.getUser(val);
                        if (user) avatarUrl = user.getAvatarURL?.();
                    }
                    addOverride(id, "author/avatar", avatarUrl);
                    refreshMessage(id);
                }
            }
        }));

        unpatches.push(commands.registerCommand({
            name: "editclear",
            description: "Clear overrides for a message or all messages",
            options: [
                { name: "id", description: "Message ID (omit to clear all)", type: 3, required: false }
            ],
            execute: (args) => {
                const id = args.find(a => a.name === "id")?.value;
                if (id) {
                    manualOverrides.delete(id);
                    refreshMessage(id);
                } else {
                    const ids = Array.from(manualOverrides.keys());
                    manualOverrides.clear();
                    ids.forEach(refreshMessage);
                }
            }
        }));
    },
    onUnload: () => {
        isEnabled = false;
        unpatches.forEach(u => u?.());
        unpatches = [];
    },
    settings: SettingPage
}
