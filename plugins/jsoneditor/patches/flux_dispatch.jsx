import { before } from "@vendetta/patcher";
import { FluxDispatcher } from "@vendetta/metro/common";
import { isEnabled, manualOverrides, setDeepValue } from "..";

const messageEvents = ["MESSAGE_CREATE", "MESSAGE_UPDATE"];

export default () => before("dispatch", FluxDispatcher, (args) => {
    if (!isEnabled) return;
    
    const ev = args[0];
    if (!ev) return;

    if (messageEvents.includes(ev.type)) {
        const id = ev.message?.id || ev.id;
        if (id && manualOverrides.has(id)) {
            const { path, value } = manualOverrides.get(id);
            const newEv = { ...ev };
            
            // Deep clone message to avoid modifying the original frozen object directly
            const baseMessage = ev.message || { id: id };
            const updatedMessage = JSON.parse(JSON.stringify(baseMessage));
            
            try {
                setDeepValue(updatedMessage, path, value);
                newEv.message = updatedMessage;
                // If the event itself has an id property (like some MESSAGE_UPDATE variants)
                if (newEv.id) newEv.id = id; 
            } catch (e) {
                console.error("[JSON Editor] Path set failed", e);
            }
            
            return [newEv];
        }
    } else if (ev.type === "LOAD_MESSAGES_SUCCESS") {
        let changed = false;
        const newMessages = ev.messages.map(m => {
            if (manualOverrides.has(m.id)) {
                changed = true;
                const { path, value } = manualOverrides.get(m.id);
                const updated = JSON.parse(JSON.stringify(m));
                try {
                    setDeepValue(updated, path, value);
                } catch (e) {
                    console.error("[JSON Editor] Path set failed", e);
                }
                return updated;
            }
            return m;
        });

        if (changed) {
            return [{ ...ev, messages: newMessages }];
        }
    }
});
