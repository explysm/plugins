import { commands } from "@vendetta";
import { FluxDispatcher } from "@vendetta/metro/common";
import { findByProps } from "@vendetta/metro";
import fluxDispatchPatch from "./patches/flux_dispatch";
import SettingPage from "./Settings";

export let isEnabled = false;
export const manualOverrides = new Map();

const SelectedChannelStore = findByProps("getChannelId");

export const setDeepValue = (obj, path, value) => {
    if (!obj) return;
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
    } else if (!isNaN(value) && value.trim() !== "") {
        // Only convert to number if it's safe (JS precision limit is ~16 digits)
        // Discord IDs are usually 18-19 digits and MUST remain strings.
        if (value.length < 16) {
            finalValue = Number(value);
        }
    }
    
    current[lastKey] = finalValue;
};

let unpatch;
export default {
    onLoad: () => {
        unpatch = fluxDispatchPatch();
        isEnabled = true;
        commands.registerCommand({
            name: "edit",
            description: "Manually edit a message JSON body",
            options: [
                { name: "id", description: "Message ID", type: 3, required: true },
                { name: "path", description: "Path (e.g. author/globalName)", type: 3, required: true },
                { name: "value", description: "New value", type: 3, required: true }
            ],
            execute: (args) => {
                const getArg = (name) => args.find(a => a.name === name)?.value;
                const id = getArg("id");
                const path = getArg("path");
                const value = getArg("value");
                if (!id || !path) return;

                manualOverrides.set(id, { path, value });
                
                // Dispatch a MESSAGE_UPDATE to trigger the patch and refresh the UI
                FluxDispatcher.dispatch({
                    type: "MESSAGE_UPDATE",
                    message: { 
                        id: id,
                        channel_id: SelectedChannelStore?.getChannelId?.()
                    },
                    otherPluginBypass: false
                });
            }
        });
    },
    onUnload: () => {
        isEnabled = false;
        unpatch?.();
    },
    settings: SettingPage
}
