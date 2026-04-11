import { commands } from "@vendetta";
import { FluxDispatcher } from "@vendetta/metro/common";
import fluxDispatchPatch from "./patches/flux_dispatch";
import SettingPage from "./Settings";

export let isEnabled = false;
export const manualOverrides = new Map(); 

export const setDeepValue = (obj, path, value) => {
    const keys = path.split('/');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!(key in current)) current[key] = {};
        current = current[key];
    }

    const lastKey = keys[keys.length - 1];
    let finalValue = value;

    if (value === "true") finalValue = true;
    else if (value === "false") finalValue = false;
    else if (!isNaN(value) && value.trim() !== "") finalValue = Number(value);

    current[lastKey] = finalValue;
};

let unpatch;

export default {
    onLoad: () => {
        unpatch = fluxDispatchPatch();
        isEnabled = true;

        commands.registerCommand({
            name: "edit",
            description: "Manually edit a message JSON body using paths (e.g. author/username)",
            options: [
                { name: "id", description: "Message ID", type: 3, required: true },
                { name: "path", description: "Path (e.g. author/globalName)", type: 3, required: true },
                { name: "value", description: "New value (string, int, or bool)", type: 3, required: true }
            ],
            execute: (args) => {
                const id = args.find(a => a.name === "id").value;
                const path = args.find(a => a.name === "path").value;
                const value = args.find(a => a.name === "value").value;

                manualOverrides.set(id, { path, value });

                FluxDispatcher.dispatch({
                    type: "MESSAGE_UPDATE",
                    message: { id: id },
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
