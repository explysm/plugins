import { getByProps } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { showToast } from "@vendetta/ui/toasts";

// Get the necessary Discord modules
const ReactionModule = getByProps("addReaction", "removeReaction");
const UserStore = getByProps("getCurrentUser");

let unpatch: () => void;

export default {
  onLoad: () => {
    // Patch the reaction addition to automatically remove self-reactions
    unpatch = after("addReaction", ReactionModule, (args, res) => {
      try {
        // args[0] is usually channelId, args[1] is messageId, args[2] is emoji
        const [channelId, messageId, emoji] = args;
        const currentUser = UserStore.getCurrentUser();

        if (!currentUser) return;

        // Small delay to ensure reaction is added before removing
        setTimeout(() => {
          try {
            ReactionModule.removeReaction(channelId, messageId, emoji, currentUser.id);
          } catch (e) {
            console.error("NoSelfReacts: Failed to remove self reaction", e);
          }
        }, 100);
      } catch (e) {
        console.error("NoSelfReacts: Error in patch", e);
      }
    });

    showToast("NoSelfReacts plugin loaded!");
  },

  onUnload: () => {
    unpatch?.();
    showToast("NoSelfReacts plugin unloaded!");
  },
};
