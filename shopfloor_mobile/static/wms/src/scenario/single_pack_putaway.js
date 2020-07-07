import {ScenarioBaseMixin, SinglePackStatesMixin} from "./mixins.js";
import {process_registry} from "../services/process_registry.js";

export var SinglePackPutAway = Vue.component("single-pack-putaway", {
    mixins: [ScenarioBaseMixin, SinglePackStatesMixin],
    template: `
        <Screen :screen_info="screen_info">
            <template v-slot:header>
                <state-display-info :info="state.display_info" v-if="state.display_info"/>
            </template>
            <searchbar v-on:found="on_scan" :input_placeholder="search_input_placeholder"></searchbar>
            <user-confirmation v-if="need_confirmation" v-on:user-confirmation="on_user_confirm" v-bind:question="user_notification.message"></user-confirmation>
            <detail-operation v-if="state.key != initial_state_key" :record="state.data" />
            <cancel-button v-on:cancel="on_cancel" v-if="show_cancel_button"></cancel-button>
        </Screen>
    `,
    data: function() {
        return {
            usage: "single_pack_putaway",
            show_reset_button: true,
            initial_state_key: "start_scan_pack_or_location",
        };
    },
});
process_registry.add("single_pack_putaway", SinglePackPutAway);