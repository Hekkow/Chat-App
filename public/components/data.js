export const Modes = {
    Move: 0,
    Width: 1,
    Height: 2,
    Size: 3,
    Rotation: 4,
    Radius: 5,
}
export const data = Vue.reactive({
    loadedUsers: new Map(),
    loadedConversations: new Map(),
    currentlyOnlineUsers: [],
    userID: -1,
    openConversationID: -1,
    editing: -1,
    replyingTo: -1,
    profilePictureOpen: false,
    modals: {
        None: 'None',
        InviteToGroupChat: 'InviteToGroupChat',
        RenameGroupChat: 'RenameGroupChat',
        TransferGroupChat: 'TransferGroupChat',
        CreateGroupChat: 'CreateGroupChat',
        BlockedUsers: 'BlockedUsers'
    },
    openModal: 'None',
    createGroupChatUsers: [],
    shapes: new Map(),
    userPopupID: -1,
    typingConversations: new Map(),
    read: new Map(),
    Modes: Modes,
    mode: Modes.Move,
    settingsOpen: false,
    focusMessageInput: false
})