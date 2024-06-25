export const data = Vue.reactive({
    loadedUsers: new Map(),
    loadedConversations: new Map(),
    currentlyOnlineUsers: [],
    userID: -1,
    openConversationID: -1,
    editing: -1,
    replyingTo: -1,
    profilePictureOpen: false,
})