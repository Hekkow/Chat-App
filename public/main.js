import App from '/components/App.js'
import {data} from '/components/data.js'
App.mount('#app')
let ws
let sessionID = Cookies.get(loginCookie)
if (!sessionID) window.location.href = '/'
else connection()
function connection() {
    let connectionRepeater
    ws = new WebSocket('ws://' + host + ':' + port + '/main')
    ws.onopen = () => {
        ws.send(JSON.stringify({type: Type.LOGIN, sessionID: sessionID}))
        console.log("Connected")
        clearInterval(connectionRepeater) // stops repeated reconnection attempts
        $('#loadingOverlay').css('display', 'none')
    }
    ws.onclose = () => {
        $('#loadingOverlay').css('display', 'block')
        connectionRepeater = setInterval(() => { // when connection broken, every 400ms, try to reconnect if possible
            if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
                console.log("Attempting to reconnect")
                connection()
            }
        }, 400)
    }
    ws.onmessage = (event) => {
        let message = JSON.parse(event.data)
        let type = message.type
        switch (type) {
            case Type.ONLINEUSERSUPDATE:
                updateLocalUsers(message.users)
                data.currentlyOnlineUsers = message.users.filter(user => user && user.userID !== data.userID && !data.loadedUsers.get(data.userID).blocked.includes(user.userID))
                break
            case Type.RECEIVEUSERNAME:
                setUp(message.user)
                break
            case Type.LOADLOCALDATA:
                loadLocalData(message)
                break
            case Type.BACKTOLOGIN:
                window.location.href = '/'
                break
            case Type.NEWMESSAGE:
                receivedNewMessage(message.message)
                break
            case Type.EDITMESSAGE:
                receivedEditMessage(message.message)
                break
            case Type.REQUESTCONVERSATION:
                let user = data.loadedUsers.get(data.userID)
                user.conversations = [...new Set(user.conversations), message.conversation.conversationID] // adds to conversations only if its not there
                updateLocalConversations([message.conversation])
                break
            case Type.CLOSECONVERSATION:
                updateLocalConversations([message.conversation])
                console.log("here", message)
                if (message.userID === data.userID) closeConversation(message.conversation.conversationID)
                break
            case Type.INVITETOGROUPCHAT:
                updateLocalConversations([message.conversation])
                let conversations = data.loadedUsers.get(data.userID).conversations
                if (!conversations.includes(message.conversation.conversationID)) conversations.push(message.conversation.conversationID)
                break

        }
    }
}
function setUp(user) {
    updateLocalUsers([user])
    data.userID = user.userID
}
function updateLocalUsers(users) {
    for (let user of users) {
        data.loadedUsers.set(user.userID, user)
    }
}
function updateLocalConversations(conversations) {
    for (let conversation of conversations) {
        data.loadedConversations.set(conversation.conversationID, conversation)
    }
}
function loadLocalData(data) {
    updateLocalUsers(data.users)
    updateLocalConversations(data.conversations)
}
function receivedNewMessage(message) {
    if (!data.loadedConversations.has(message.conversationID)) {
        ws.send(JSON.stringify({ type: Type.REQUESTCONVERSATION, conversationID: message.conversationID, conversationType: direct }))
        return
    }
    if (message.userID === data.userID) data.loadedConversations.get(message.conversationID).texts.find(text => !text.messageID || text.messageID === -1).messageID = message.messageID
    else addMessage(message)
}
function receivedEditMessage(message) {
    editMessage(message)
}
export function openConversation(conversationID) {
    if (conversationID === -1) return
    data.openConversationID = conversationID
}
export function leaveConversation(conversationID, userID) {
    if (conversationID === -1) return
    console.log(conversationID)
    ws.send(JSON.stringify({
        type: Type.CLOSECONVERSATION,
        userID: userID,
        conversationID: conversationID,
        conversationType: data.loadedConversations.get(conversationID).conversationType
    }))
    if (userID === data.userID) closeConversation(conversationID)
}
function closeConversation(conversationID) {
    data.loadedConversations.delete(conversationID)
    let user = data.loadedUsers.get(data.userID)
    user.conversations = user.conversations.filter(c => c !== conversationID)
    if (conversationID === data.openConversationID) data.openConversationID = -1
}
export function startConversation(receivingUserID) {
    let users = [receivingUserID, data.userID]
    for (const [, conversation] of data.loadedConversations.entries()) {
        conversation.users.sort()
        users.sort()
        if (conversation.conversationType === direct && conversation.users.length === users.length && conversation.users.every((user, index) => user === users[index])) {
            openConversation(conversation.conversationID)
            return
        }
    }
    ws.send(JSON.stringify({ type: Type.REQUESTCONVERSATION, conversationID: [receivingUserID, data.userID], conversationType: direct }))
}
function editMessage(message) {
    data.loadedConversations.get(message.conversationID).texts.find(text => text.messageID === message.messageID).message = message.message
}
function addMessage(message) { // can't just push because for some reason vue isn't
    let conversation = data.loadedConversations.get(message.conversationID)
    conversation.texts = [...conversation.texts, message]
}
export function sendMessage() {
    let messageInput = $('#messageInput')
    let text = messageInput.val().trim()
    messageInput.val("")
    messageInput.focus()
    if (!text || !text.trim()) return
    let message = {
        conversationID: data.openConversationID,
        userID: data.userID,
        message: text,
        date: new Date(),
        messageID: data.editing,
        replyingTo: data.replyingTo
    }
    if (data.editing === -1) addMessage(message)
    else editMessage(message)
    ws.send(JSON.stringify({type: data.editing === -1 ? Type.NEWMESSAGE : Type.EDITMESSAGE, message: message}))
    closeReply()
}
function closeReply() {
    data.editing = -1
    data.replyingTo = -1
}
$('#messageInput').keydown((event) => {
    if (event.key === "Enter" && !event.originalEvent.shiftKey) {
        event.preventDefault()
        sendMessage()
    }
})
export function deleteMessage(messageID) {
    let conversation = data.loadedConversations.get(data.openConversationID)
    conversation.texts = conversation.texts.filter(text => text.messageID !== messageID)
    ws.send(JSON.stringify({
        type: Type.DELETEMESSAGE,
        messageID: messageID,
        user: data.userID,
        conversationID: data.openConversationID
    }))
}
export function startEdit(messageID) {
    let conversation = data.loadedConversations.get(data.openConversationID)
    let messageInput = $('#messageInput')
    messageInput.val(conversation.texts.find(text => text.messageID === messageID).message)
    messageInput.focus()
    data.editing = messageID
}

export function createNewGroupChat() {
    ws.send(JSON.stringify({
        type: Type.REQUESTCONVERSATION,
        conversationID: [...data.createGroupChatUsers, data.userID],
        conversationType: group,
        leader: data.userID
    })) // conversationID here is users array
    data.openModal = data.modals.None
}
export function inviteToGroupChat() {
    ws.send(JSON.stringify({
        type: Type.INVITETOGROUPCHAT,
        conversationID: data.openConversationID,
        users: data.createGroupChatUsers
    }))
    data.openModal = data.modals.None
}
export function scrollToBottom() {
    let messages = $('#messages')
    // if (messages.prop("scrollHeight") - (messages.scrollTop() + messages.height()) > 100) return
    messages.scrollTop(messages.prop("scrollHeight"))
}

function startProfilePicCreator() {
    data.profilePictureOpen = true
}
window.startProfilePicCreator = startProfilePicCreator

// not sure if i need these
window.sendMessage = sendMessage
window.deleteMessage = deleteMessage
// window.openConversation = openConversation