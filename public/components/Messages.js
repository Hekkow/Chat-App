import {data} from "./data.js";
import {scrollToBottom} from "../main.js";

export default {
    data() {
        return {
            data: data
        }
    },
    template: `
      <message v-if="data.openConversationID !== -1" v-for="message in texts" :message="message"></message>
    `,
    computed: {
        texts() {
            if (data.openConversationID === -1) return
            return data.loadedConversations.get(data.openConversationID).texts;
        }
    },
    watch: {
        texts: {
            immediate: true,
            handler() {
                this.$nextTick(() => scrollToBottom())
            }
        },
        'data.openConversationID': {
            immediate: true,
            handler() {
                this.$nextTick(() => scrollToBottom())
            }
        }
    },
}