import { before } from "@vendetta/patcher";
import { FluxDispatcher } from "@vendetta/metro/common";
import { isEnabled, manualOverrides, setDeepValue } from "..";

export default () => before("dispatch", FluxDispatcher, args => {
    if (isEnabled) {
        const ev = args[0];
        if (!ev || ev.type !== "MESSAGE_UPDATE") return;
        if (ev.otherPluginBypass) return;

        const id = ev.message?.id || ev.id;

        if (manualOverrides.has(id)) {
            const { path, value } = manualOverrides.get(id);
            const updatedMessage = { ...ev.message };
            setDeepValue(updatedMessage, path, value);
            ev.message = updatedMessage;
            return args; 
        }
    }
});
