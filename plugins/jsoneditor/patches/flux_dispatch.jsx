import { before } from "@vendetta/patcher";
import { FluxDispatcher } from "@vendetta/metro/common";
import { findByProps } from "@vendetta/metro";
import { isEnabled, manualOverrides, setDeepValue } from "..";

const messageEvents = ["MESSAGE_CREATE", "MESSAGE_UPDATE"];
const MessageStore = findByProps("getMessage", "getMessages");

const applyOverrides = (message) => {
    if (!message || !message.id) return message;
    const overrides = manualOverrides.get(message.id);
    if (!overrides) return message;

    // Clone to avoid modifying store objects directly
    const updated = JSON.parse(JSON.stringify(message));
    for (const [path, value] of overrides.entries()) {
        try {
            setDeepValue(updated, path, value);
        } catch (e) {
            console.error(`[JSON Editor] Failed to set ${path}`, e);
        }
    }
    return updated;
};

export default () => before("dispatch", FluxDispatcher, (args) => {
    if (!isEnabled) return;
    
    const ev = args[0];
    if (!ev) return;

    if (messageEvents.includes(ev.type)) {
        const id = ev.message?.id || ev.id;
        if (id && manualOverrides.has(id)) {
            const channelId = ev.message?.channel_id || ev.channelId;
            const existingMsg = MessageStore.getMessage(channelId, id);
            
            // Merge update with existing message to avoid losing data
            const baseMessage = { ...existingMsg, ...(ev.message || {}) };
            const updatedMessage = applyOverrides(baseMessage);
            
            const newEv = { ...ev, message: updatedMessage };
            if (newEv.id) newEv.id = id;
            
            return [newEv];
        }
    } else if (ev.type === "LOAD_MESSAGES_SUCCESS") {
        let changed = false;
        const newMessages = ev.messages.map(m => {
            if (manualOverrides.has(m.id)) {
                changed = true;
                return applyOverrides(m);
            }
            return m;
        });

        if (changed) {
            return [{ ...ev, messages: newMessages }];
        }
    }
});
