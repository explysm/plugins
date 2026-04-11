import { before } from "@vendetta/patcher";
import { FluxDispatcher } from "@vendetta/metro/common";
import { isEnabled, manualOverrides, setDeepValue } from "..";

export default () => before("dispatch", FluxDispatcher, (args) => {
    if (!isEnabled) return;
    
    const ev = args[0];
    if (!ev || ev.type !== "MESSAGE_UPDATE") return;
    if (ev.otherPluginBypass) return;

    const id = ev.message?.id || ev.id;
    if (!id) return;

    if (manualOverrides.has(id)) {
        const { path, value } = manualOverrides.get(id);
        
        // Ensure ev.message exists before cloning
        const baseMessage = ev.message || { id: id };
        const updatedMessage = JSON.parse(JSON.stringify(baseMessage));
        
        try {
            setDeepValue(updatedMessage, path, value);
            ev.message = updatedMessage;
        } catch (e) {
            console.error("[JSON Editor] Path set failed", e);
        }
        
        return args;
    }
});
