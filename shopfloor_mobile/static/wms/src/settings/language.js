export var Language = Vue.component("language", {
    data: function() {
        return {
            language_selected: false,
            user_notif_updated: {
                message: "Language updated",
                message_type: "info",
            },
        };
    },
    template: `
        <Screen :title="$t('screen.settings.language.title')" :klass="'settings settings-language'">
            <manual-select
                :records="available_languages"
                :options="{initValue: current_language_code}"
                v-on:select="on_select"
                />

            <div class="button-list button-vertical-list full">
                <v-row align="center">
                    <v-col class="text-center" cols="12">
                        <btn-back/>
                    </v-col>
                </v-row>
            </div>
        </Screen>
    `,
    methods: {
        on_select: function(selected) {
            const self = this;
            this.$i18n.locale = selected.id;
            // this.$root.trigger("language:selected", selected, true);
            self.$root.$router.push({name: "home"});
        },
    },
    computed: {
        available_languages() {
            // FIXME: this should come from odoo and from app config
            // They will match w/ $i18n.availableLocales
            return [
                {
                    id: "en-US",
                    name: this.$t("language.name.English"),
                },
                {
                    id: "fr-FR",
                    name: this.$t("language.name.French"),
                },
                {
                    id: "de-DE",
                    name: this.$t("language.name.German"),
                },
            ];
        },
        current_language_code() {
            return this.$i18n.locale || "en-US";
        },
    },
});
