import {openConversation} from "../main.js";
import {data} from "./data.js";
export default {
    data() {
        return {
            data: data
        }
    },
    template: `
      <button class="conversationBlock itemBlock" :data-conversationID="conversation.conversationID" @click="openConversation(this.conversation.conversationID)">
        <div class="blockText">{{conversationBlockText}}</div>
      </button>
    `,
    props: {
        conversation: {
            type: Object
        },
    },
    methods: {
        openConversation,
    },
    computed: {
        conversationBlockText() {
            let conversationName = this.conversation.conversationName
            if (!conversationName) conversationName = this.conversation.users.filter(userID => userID !== data.userID).map(userID => data.loadedUsers.get(userID).username).join(', ')
            let lastMessage = this.conversation.texts[this.conversation.texts.length - 1]
            if (!lastMessage) return conversationName
            let lastMessageText = lastMessage.message
            let lastTextUsername = lastMessage.userID === -1 ? "Server" : data.loadedUsers.get(lastMessage.userID).username
            if (lastMessageText.length > 18) lastMessageText = lastMessageText.substring(0, 15) + "..."
            return conversationName + "\n" + lastTextUsername + ": " + lastMessageText
        }
    }

}