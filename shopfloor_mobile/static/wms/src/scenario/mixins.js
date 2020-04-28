export var ScenarioBaseMixin = {
    data: function() {
        return {
            user_notification: {
                message: "",
                message_type: "",
            },
            need_confirmation: false,
            show_reset_button: false,
            initial_state_key: "start",
            current_state_key: "",
            states: {},
            usage: "", // Match component usage on odoo,
        };
    },
    beforeRouteUpdate(to, from, next) {
        // Load initial state
        // const state = to.params.state ? to.params.state : 'start';
        const state = to.query.state ? to.query.state : "start";
        this.go_state(state);
        next();
    },
    beforeMount: function() {
        this._loadParams();
        if (this.$root.demo_mode) {
            this.$root.loadJS("src/demo/demo." + this.usage + ".js", this.usage);
        }
        /*
        Ensure initial state is set.
        beforeRouteUpdate` runs only if the route has changed,
        which means that if your reload the page it won't get called :(
        We could use `beforeRouteEnter` but that's not tied to the current instance
        and we won't be able to call `go_state`.
        */
        if (!this.current_state_key) {
            // Default to initial state
            this.current_state_key = this.initial_state_key;
        }
        this.go_state(this.current_state_key);
    },
    mounted: function() {
        const odoo_params = {
            process_id: this.menu_item.process.id,
            process_menu_id: this.menu_item.id,
            profile_id: this.$root.profile.id,
            usage: this.usage,
        };
        this.odoo = this.$root.getOdoo(odoo_params);
    },
    beforeDestroy: function() {
        // TODO: we should turn off only handlers for the current state
        this.$root.event_hub.$off();
    },
    computed: {
        /*
        Full object of current state
        */
        state: function() {
            const state = {
                key: this.current_state_key,
                data: this.state_get_data(),
            };
            _.extend(state, this.states[this.current_state_key]);
            _.defaults(state, {display_info: {}});
            return state;
        },
        search_input_placeholder: function() {
            if (this.state.scan_placeholder) {
                // TMP backward compat
                return this.state.scan_placeholder;
            }
            return this.state.display_info.scan_placeholder;
        },
        show_cancel_button: function() {
            return this.state.display_info.show_cancel_button;
        },
        screen_info: function() {
            return {
                title: this.menu_item.name,
                klass: this.usage + " " + "state-" + this.state.key,
            };
        },
    },
    methods: {
        /*
        Load menu item from storage using route's menu id
        */
        _loadParams: function() {
            const self = this;
            this.menu_item = _.head(
                _.filter(this.$root.appconfig.menus, function(m) {
                    return m.id === parseInt(self.$route.query.menu_id, 10);
                })
            );
            this.current_state_key = this.$route.query.state;
        },
        storage_key: function(state_key) {
            state_key = _.isUndefined(state_key) ? this.current_state_key : state_key;
            return this.usage + "." + state_key;
        },
        /*
        Switch state to given one.
        */
        state_to: function(state_key) {
            return this.$router
                .push({
                    path: this.$route.path,
                    query: {
                        menu_id: this.menu_item.id,
                        state: state_key,
                    },
                })
                .catch(() => {
                    // see https://github.com/quasarframework/quasar/issues/5672
                    console.error("No new route found");
                });
        },
        // Generic states methods
        state_is: function(state_key) {
            return state_key == this.current_state_key;
        },
        state_in: function(state_keys) {
            return _.filter(state_keys, this.state_is).length > 0;
        },
        state_reset_data: function(state_key) {
            this.$root.$storage.remove(this.storage_key(state_key));
        },
        _state_get_data: function(storage_key) {
            return this.$root.$storage.get(storage_key, {});
        },
        _state_set_data: function(storage_key, v) {
            this.$root.$storage.set(storage_key, v);
        },
        state_get_data: function(state_key) {
            return this._state_get_data(this.storage_key(state_key));
        },
        state_set_data: function(data, state_key) {
            const new_data = _.merge({}, this.state_get_data(state_key), data);
            this._state_set_data(this.storage_key(state_key), new_data);
        },
        go_state: function(state_key, promise) {
            // console.log("GO TO STATE", state_key);
            if (state_key == "start") {
                // Alias "start" to the initial state
                state_key = this.initial_state_key;
            }
            if (!_.has(this.states, state_key)) {
                alert("State `" + state_key + "` does not exists!");
            }
            this.on_exit();
            this.current_state_key = state_key;
            if (promise) {
                promise.then(this.on_success, this.on_error);
            } else {
                this.on_enter();
            }
            this._state_bind_events();
            // notify root
            // TODO: maybe not needed after introducing routing
            this.$root.$emit("state:change", state_key);
        },
        // TODO: refactor all transitions to state `wait_call` with this call
        wait_call: function(promise, next_state) {
            const self = this;
            return promise.then(function(result) {
                const state = next_state || result.next_state;
                if (!_.isUndefined(result.data)) {
                    self.state_reset_data(state);
                    self.state_set_data(result.data[state], state);
                }
                if (!_.isUndefined(result) && !result.error) {
                    // TODO: consider not changing the state if it is the same to not refresh
                    self.state_to(state);
                } else {
                    alert(result.status + " " + result.error);
                }
            });
        },
        on_enter: function() {
            if (this.state.enter) {
                this.state.enter();
            }
        },
        on_exit: function() {
            if (this.state.exit) {
                this.state.exit();
            }
        },
        on_success: function(result) {
            if (result.message) {
                this.set_notification(result.message);
            } else {
                this.reset_notification();
            }
            if (this.state.success) {
                this.state.success(result);
            }
            this.on_enter();
        },
        on_error: function(result) {
            if (this.state.error) {
                this.state.error(result);
            }
        },
        on_reset: function(e) {
            this.state_reset_data();
            this.reset_notification();
            this.go_state(this.initial_state_key);
        },
        // Specific states methods
        on_scan: function(scanned) {
            if (this.state.on_scan) {
                this.state.on_scan(scanned);
            }
        },
        // on_select: function(selected) {
        //     if (this.state.on_select) {
        //         this.state.on_select(selected);
        //     }
        // },
        // on_back: function() {
        //     if (this.state.on_back) {
        //         this.state.on_back();
        //     }
        // },
        on_cancel: function() {
            if (this.state.on_cancel) {
                this.state.on_cancel();
            }
        },
        on_user_confirm: function(answer) {
            this.state.on_user_confirm(answer);
            this.need_confirmation = false;
            this.reset_notification();
        },
        set_notification: function(message) {
            this.user_notification.message = message.message;
            this.user_notification.message_type = message.message_type;
        },
        reset_notification: function() {
            this.user_notification.message = false;
            this.user_notification.message_type = false;
        },
        _state_bind_events: function() {
            if (this.state.events) {
                /*
                Automatically bind events defined by states.
                A state can define `events` w/ this structure:

                    events: {
                        '$event_name': '$handler',
                    },

                `$handler_name` must match a function or the name of a function
                available in the state.

                The event name is prefixed w/ the state key so that
                any component can subscribe globally,
                via the event hub at root level,
                to a particular event fired on a specific state
                */
                const self = this;
                _.each(self.state.events, function(handler, name) {
                    if (typeof handler == "string") handler = self.state[handler];
                    const event_name = self.state.key + ":" + name;
                    // Wipe old handlers
                    // TODO: any way to register them just once?
                    self.$root.event_hub.$off(event_name, handler);
                    self.$root.event_hub.$on(event_name, handler);
                });
            }
        },
    },
};

// TODO: move it to a specific file maybe
export var SinglePackStatesMixin = {
    data: function() {
        return {
            states: {
                // Generic state for when to start w/ scanning a pack
                start_scan_pack: {
                    display_info: {
                        title: "Start by scanning a pack",
                        scan_placeholder: "Scan pack",
                    },
                    enter: () => {
                        this.state_reset_data();
                    },
                    on_scan: scanned => {
                        this.wait_call(
                            this.odoo.call("start", {barcode: scanned.text})
                        );
                    },
                },
                // Generic state for when to start w/ scanning a pack or loc
                start_scan_pack_or_location: {
                    display_info: {
                        title: "Start by scanning a pack or a location",
                        scan_placeholder: "Scan pack",
                    },
                    enter: () => {
                        this.state_reset_data();
                    },
                    on_scan: scanned => {
                        this.wait_call(
                            this.odoo.call("start", {barcode: scanned.text})
                        );
                    },
                },
                // TODO: these states should be splitted out to a specific mixin
                // for putaway and pack transfer
                scan_location: {
                    display_info: {
                        title: "Set a location",
                        scan_placeholder: "Scan location",
                        show_cancel_button: true,
                    },
                    on_scan: (scanned, confirmation = false) => {
                        this.state_set_data({location_barcode: scanned.text});
                        this.wait_call(
                            this.odoo.call("validate", {
                                package_level_id: this.state.data.id,
                                location_barcode: scanned.text,
                                confirmation: confirmation,
                            })
                        );
                    },
                    on_cancel: () => {
                        this.wait_call(
                            this.odoo.call("cancel", {
                                package_level_id: this.state.data.id,
                            })
                        );
                    },
                },
                confirm_location: {
                    display_info: {
                        scan_placeholder: "Scan location",
                    },
                    enter: () => {
                        this.need_confirmation = true;
                    },
                    exit: () => {
                        this.need_confirmation = false;
                    },
                    on_user_confirm: answer => {
                        if (answer == "yes") {
                            // Reuse data from scan_location and
                            // simulate the event that on_scan expects
                            const scan_data = this.state_get_data("scan_location");
                            this.state.on_scan(
                                {
                                    text: scan_data.location_barcode,
                                },
                                true
                            );
                        } else {
                            this.state_to("scan_location");
                        }
                    },
                    on_scan: (scanned, confirmation = true) => {
                        this.on_exit();
                        this.current_state_key = "scan_location";
                        this.state.on_scan(scanned, confirmation);
                    },
                },
                confirm_start: {
                    display_info: {
                        title: "Confirm start and select a location",
                        scan_placeholder: "Scan location",
                    },
                    enter: () => {
                        this.need_confirmation = true;
                    },
                    exit: () => {
                        this.need_confirmation = false;
                    },
                    on_user_confirm: answer => {
                        if (answer == "yes") {
                            // Keep the data received from previous state but not the question answered
                            const state_data = this.state_get_data(
                                this.current_state_key
                            );
                            state_data.message = {};
                            this.state_set_data(state_data, "scan_location");
                            this.state_to("scan_location");
                        } else {
                            this.state_to("start");
                        }
                    },
                    on_scan: scanned => {
                        this.on_exit();
                        this.current_state_key = "scan_location";
                        this.state.on_scan(scanned);
                    },
                },
            },
        };
    },
};