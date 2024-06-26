// TONS of glitches now, gotta fix em all
// - remove read receipts from users that left conversation
// - notification remains if kicked from group chat
// - notification doesnt work often
// - doesn't work if multiple tabs of same user open
let sessionID = Cookies.get(loginCookie)
let userID
let username
let ws
let openConversationID = -1
let loadedConversations = new Map()
let loadedUsers = new Map()
let loadedReadMessages = [] // possibly switch to another data structure later
let contextMenuOpen = false
if (!sessionID) window.location.href = '/'
else connection()
let replyingTo = -1
let editing = -1
let typing = false

import App from '/components/App.js'
import {data} from '/components/data.js'
App.mount('#app')
function openConversation(conversationID) {
    if (conversationID === -1) return
    ws.send(JSON.stringify({type: Type.REQUESTTYPING, conversationID: conversationID}))
    closeConversationArea()
    removeGroupChatPopup()
    if (loadedConversations.get(conversationID).texts.length > 0) showNewConversationButton(loadedConversations.get(conversationID))
    openConversationID = conversationID
    openConversationArea()
    removeNotification(conversationID)
    let conversation = loadedConversations.get(conversationID)
    for (let message of conversation.texts) {
        if (message.userID === -1) showServerMessage(message.message, message.messageID)
        else showMessage(message, loadedUsers.get(message.userID).username === username)
    }
    updateChatParticipants(conversation)
    updateReadMessages()
}
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
        // console.log(message)
        let type = message.type
        switch (type) {
            case Type.ONLINEUSERSUPDATE:
                if (Array.isArray(message.users)) {
                    for (let user of message.users) {
                        data.loadedUsers.set(user.userID, user)
                    }
                } else data.loadedUsers.set(message.users.userID, message.users)
                data.currentlyOnlineUsers = message.users.filter(user => user && user.userID !== userID && !loadedUsers.get(userID).blocked.includes(user.userID))
                // updateUserList(message.users)
                break
            case Type.RECEIVEUSERNAME:
                setUp(message.user)
                break
            case Type.BACKTOLOGIN:
                window.location.href = '/'
                break
            case Type.LOADLOCALDATA:
                loadLocalData(message)
                break
            case Type.STARTCONVERSATION:
                updateLocalConversations(message.conversation)
                openConversationID = message.conversation.conversationID
                break
            case Type.CONVERSATIONCREATED:
                conversationCreated(message.conversation)
                break
            case Type.CLOSECONVERSATION:
                updateConversation(message.conversation, "close", message.userID)
                break
            case Type.REQUESTCONVERSATION:
                updateLocalConversations(message.conversation)
                showNewConversationButton(message.conversation)
                break
            case Type.INVITETOGROUPCHAT:
                updateConversation(message.conversation)
                break
            case Type.RENAMEGROUPCHAT:
                updateConversation(message.conversation)
                break
            case Type.NEWMESSAGE:
                receivedNewMessage(message.message)
                break
            case Type.FIRSTMESSAGE:
                receivedNewFirstMessage(message)
                break
            case Type.DELETEMESSAGE:
                receivedDeletedMessage(message.messageID)
                break
            case Type.EDITMESSAGE:
                receivedEditedMessage(message.message)
                break
            case Type.READMESSAGE:
                receivedReadMessage(message)
                break
            case Type.TYPING:
                receivedTyping(message)
                break
            case Type.NEWSERVERMESSAGE:
                receivedNewServerMessage(message)
                break
            case Type.TRANSFERLEADER:
                updateConversation(message.conversation)
                if (message.conversation.conversationID === openConversationID) {
                    openConversation(openConversationID)
                }
                break
            case Type.PROFILEPICUPDATE:
                if (message.userID === userID) break
                loadedUsers.get(message.userID).profilePic = message.profilePic
                drawShapes(`${message.userID}`, message.profilePic)
                break
            case Type.BLOCKUSER:
                loadedUsers.get(message.userID).blocked.push(userID)
                break
        }
    }
}
function updateConversation(conversation, mode, closedUserID) {
    updateLocalConversations(conversation)
    updateConversationButton(conversation.conversationID)
    updateChatParticipants(conversation)
    if (mode === "close" && closedUserID === userID) {
        $(`.conversationBlock[conversationID=${conversation.conversationID}]`).remove()
        if (openConversationID === conversation.conversationID) closeConversationArea()
    }
}

function receivedTyping(message) {
    if (message.conversationID !== openConversationID) return
    $('#typingIndicatorDiv').text(message.conversationTyping.filter(thisUserID => thisUserID !== userID).map(userID => loadedUsers.get(userID).username + " is typing, "))
}

function setUp(user) {
    updateLocalUsers(user)
    username = user.username
    userID = user.userID
    // $('#loggedInUsername').text(username)
}

function conversationCreated(conversation) {
    updateLocalConversations(conversation)
    openConversation(conversation.conversationID)
    if (conversation.conversationType === group) showNewConversationButton(conversation)
}

function receivedNewFirstMessage(data) {
    // for when both users open the conversation before one sends a message
    if (data.conversation.conversationID === openConversationID) {
        receivedNewMessage(data.message)
        return
    }
    loadedConversations.set(data.conversation.conversationID, data.conversation)
    showOrUpdateConversationButton(data.conversation.conversationID)
    showNotification(data.conversation.conversationID.conversationID)
}

function receivedNewMessage(message) {
    if (!requestConversationIfNeeded(message.conversationID)) return
    loadedConversations.get(message.conversationID).texts.push(message)

    if (message.conversationID === openConversationID) {
        updateMessageID(message) // seems like it could be possibly weird?
        if (loadedUsers.get(message.userID).username !== username) showMessage(message, false)
        else if (!$(`.messageDiv[messageID=${message.messageID}]`).length) showMessage(message, true)
    }
    showOrUpdateConversationButton(message.conversationID)
    showNotification(message.conversationID)
}

function requestConversationIfNeeded(conversationID) {
    if (!loadedConversations.has(conversationID)) {
        ws.send(JSON.stringify({type: Type.REQUESTCONVERSATION, conversationID: conversationID}))
        return false
    }
    return true
}

function receivedNewServerMessage(message) {
    if (!requestConversationIfNeeded(message.conversationID)) return
    loadedConversations.get(message.conversationID).texts.push({
        conversationID: message.conversationID,
        message: message.text,
        date: new Date(),
        userID: -1,
        messageID: message.messageID
    })
    if (message.conversationID === openConversationID) {
        showServerMessage(message.text, message.messageID)
    }
    showOrUpdateConversationButton(message.conversationID)
    showNotification(message.conversationID)

}

function showNotification(conversationID) {
    if (conversationID !== openConversationID || !document.hasFocus()) {
        actuallyShowNotification(conversationID)
    } else sendReadReceipt(conversationID)
}

function actuallyShowNotification(conversationID) {
    $(`.conversationBlock[conversationID=${conversationID}]`).css('font-weight', 'bold')
    document.title = "NOTIFICATION"
}

function removeNotification(conversationID) {
    if (conversationID === -1) return
    $(`.conversationBlock[conversationID=${conversationID}]`).css('font-weight', 'normal')
    document.title = "Title"
    sendReadReceipt(conversationID)
}

function sendReadReceipt(conversationID) {
    let conversation = loadedConversations.get(conversationID)
    let message = conversation.texts[conversation.texts.length - 1]
    if (!message) return
    let messageID = message.messageID
    if (messageID === -1) return
    // sends even if already read, fix this
    ws.send(JSON.stringify({
        type: Type.READMESSAGE,
        userID: userID,
        conversationID: conversationID,
        messageID: messageID
    }))
}

$(window).on('focus', function () {
    removeNotification(openConversationID)
})

function receivedReadMessage(message) {
    updateLocalReadMessages(message)
    if (message.conversationID === openConversationID) updateReadMessages(openConversationID)
}


function updateReadMessages() {
    for (let entry of loadedReadMessages) {
        if (entry.conversationID === openConversationID && entry.userID !== userID) {
            $(`.readIndicator[userID=${entry.userID}]`).remove()
            if (!loadedUsers.has(entry.userID)) continue // possibly weird, fix this later maybe
            if (loadedUsers.get(userID).blocked.includes(entry.userID)) continue
            $(`.messageDiv[messageID=${entry.messageID}]`).append(`<div class="readIndicator" userID=${entry.userID}>READ BY ${loadedUsers.get(entry.userID).username}</div>`)
        }
    }

}

function receivedEditedMessage(message) {
    let messageDiv = $(`.messageDiv[messageID=${message.messageID}]`)
    messageDiv.find('.messageText').text(`${loadedUsers.get(message.userID).username}: ${message.message}`)
    messageDiv.removeClass('localMessage')
    updateTextsAndButton(message.messageID, "Edit", message)
}

function receivedDeletedMessage(messageID) {
    $(`.messageDiv[messageID='${messageID}']`).remove()
    $(`.messageDiv[replyingTo='${messageID}']`).find('.replyText').text("Replying to: Deleted Message")
    if (messageID === replyingTo) closeReplyBar()
    updateTextsAndButton(messageID, "Delete")
}

function updateTextsAndButton(messageID, mode, message) {
    let conversationBlock = $(`.conversationBlock[messageID=${messageID}]`)
    if (conversationBlock.length) {
        let conversationID = parseInt(conversationBlock.attr('conversationID'))
        if (loadedConversations.has(conversationID)) {
            let texts = loadedConversations.get(conversationID).texts
            if (mode === "Edit") texts[texts.findIndex(text => text.messageID === messageID)].message = message.message
            else if (mode === "Delete") texts.splice(texts.findIndex(text => text.messageID === messageID))
        }
        updateConversationButton(conversationID)
    }
}

function showOrUpdateConversationButton(conversationID) {
    if ($(`.conversationBlock[conversationID=${conversationID}]`).length) updateConversationButton(conversationID)
    else showNewConversationButton(loadedConversations.get(conversationID))
}

function showNewConversationButton(conversation) {
    let conversationID = conversation.conversationID
    let activeConversationsDiv = $("#activeConversations")
    let stuff = getTextForConversationButton(conversation)
    if ($(`.conversationBlock[conversationID=${conversationID}]`).length) return
    let newConversationBlock = $(`
            <button class="conversationBlock itemBlock" conversationID="${conversationID}" onclick="openConversation(${conversationID})" messageID="${stuff.messageID}" date="${stuff.date}">
                <div class="userPic"></div>
                <div class="blockText">${stuff.text}</div>
            </button>`)
    // places it in order of most recent texts
    let placed = false
    $('.conversationBlock').each(function () {
        if (new Date($(this).attr('date')) < new Date(stuff.date)) {
            newConversationBlock.insertBefore($(this))
            placed = true
            return false
        }
    })
    if (!placed) activeConversationsDiv.append(newConversationBlock)
    $(`.conversationBlock`).contextmenu((e) => showConversationContextMenu(e))
}




function updateConversationButton(conversationID) {
    let conversation = loadedConversations.get(conversationID)
    let stuff = getTextForConversationButton(conversation)
    let conversationButton = $(`.conversationBlock[conversationID=${conversation.conversationID}]`)
    conversationButton.find('.blockText').html(stuff.text)
    conversationButton.attr('messageID', stuff.messageID)
    conversationButton.attr('date', stuff.date)
    if ($('.conversationBlock').length > 1) conversationButton.detach().insertBefore('.conversationBlock:first')
}

function removeConversation(conversationID) {
    $(`.conversationBlock[conversationID=${conversationID}]`).remove()
    ws.send(JSON.stringify({
        type: Type.CLOSECONVERSATION,
        userID: userID,
        conversationID: conversationID,
        conversationType: loadedConversations.get(conversationID).conversationType
    }))
    closeConversationArea()
}

function getTextForConversationButton(conversation) {
    let conversationName
    let lastMessage = conversation.texts[conversation.texts.length - 1]
    let lastMessageText = lastMessage ? lastMessage.message : ""
    let lastTextUsername = ""
    if (lastMessage) {
        if (lastMessage.userID === -1) lastTextUsername = "Server"
        else lastTextUsername = loadedUsers.get(lastMessage.userID).username
    }
    if (lastMessageText.length > 18) lastMessageText = lastMessageText.substring(0, 15) + "..."
    if (conversation.conversationType === direct) {
        conversationName = conversation.users.map(userID => loadedUsers.get(userID).username).filter(user => user !== username)
    } else if (conversation.conversationType === group) {
        conversationName = conversation.conversationName
        if (!conversationName) conversationName = conversation.users.map(userID => loadedUsers.get(userID).username).filter(user => user !== username)
    }
    let text = conversationName
    if (lastMessage) text += "<br>" + lastTextUsername + ": " + lastMessageText
    return {
        messageID: lastMessage ? lastMessage.messageID : -1,
        text: text,
        date: lastMessage ? lastMessage.date : new Date()
    }
}

function loadLocalData(data) {
    $("#activeConversations").empty()
    updateLocalUsers(data.users)
    updateLocalConversations(data.conversations)
    updateLocalReadMessages(data.readMessages)
    for (let conversationID of loadedUsers.get(userID).conversations) {
        let conversation = loadedConversations.get(conversationID)
        updateConversation(conversation)
        showNewConversationButton(conversation)
    }
    showOfflineNotifications()
}

function showOfflineNotifications() {
    $('.conversationBlock').each(function () {
        let entry = loadedReadMessages.find(entry => entry.conversationID === parseInt($(this).attr('conversationID')) && entry.userID === userID)
        if (!entry) return
        if (parseInt($(this).attr('messageID')) > entry.messageID) actuallyShowNotification(entry.conversationID)
    })
}

function updateLocalReadMessages(readMessages) {
    if (!Array.isArray(readMessages)) readMessages = [readMessages]
    for (let readMessage of readMessages) {
        let found = false
        for (let entry of loadedReadMessages) {
            if (readMessage.conversationID === entry.conversationID && readMessage.userID === entry.userID) {
                entry.messageID = readMessage.messageID
                found = true
                break
            }
        }
        if (!found) loadedReadMessages.push({
            userID: readMessage.userID,
            conversationID: readMessage.conversationID,
            messageID: readMessage.messageID
        })
    }
}

function updateLocalUsers(users) {
    if (Array.isArray(users)) {
        for (let user of users) {
            loadedUsers.set(user.userID, user)
        }
    } else loadedUsers.set(users.userID, users)
}

function updateLocalConversations(conversations) {
    if (Array.isArray(conversations)) {
        for (let conversation of conversations) {
            loadedConversations.set(conversation.conversationID, conversation)
        }
    } else loadedConversations.set(conversations.conversationID, conversations)
}

function updateChatParticipants(conversation) {
    if (conversation.conversationID !== openConversationID) return
    let chatParticipantsDiv = $('#chatParticipants')
    chatParticipantsDiv.empty()
    for (let user of conversation.users.map(userID => loadedUsers.get(userID))) {
        chatParticipantsDiv.append(
            `<button class='participantBlock itemBlock' participantUserID=${user.userID} onclick='startNewConversation(${user.userID})'>
                ${showProfilePic(user.userID, 100)}
                <div class='blockText'>${user.username}</div>
            </button>`)
        drawShapes(`${user.userID}`, user.profilePic)
    }

    $('.participantBlock').contextmenu((e) => showParticipantContextMenu(e))
}

function removeParticipant(participantUserID) {
    ws.send(JSON.stringify({
        type: Type.CLOSECONVERSATION,
        userID: participantUserID,
        conversationID: openConversationID,
        conversationType: loadedConversations.get(openConversationID).conversationType
    }))
    $(`.participantBlock[participantUserID=${participantUserID}]`).remove()
}

function startNewConversation(receivingUserID) {
    let users = [receivingUserID, userID]
    for (const [key, value] of loadedConversations.entries()) {
        value.users.sort()
        users.sort()
        if (value.conversationType === direct && value.users.length === users.length && value.users.every((user, index) => user === users[index])) {
            openConversation(value.conversationID)
            return
        }
    }
    ws.send(JSON.stringify({
        type: Type.STARTCONVERSATION,
        conversationID: [receivingUserID, userID],
        conversationType: direct
    }))
}

function openConversationArea() {
    let conversation = loadedConversations.get(openConversationID)
    if (conversation.conversationType === group) {
        let groupChatButtonsDiv = $('#groupChatButtonsDiv')
        groupChatButtonsDiv.addClass('active')
        groupChatButtonsDiv.append('<button class="groupChatButton" onclick="showInviteToGroupChatPopup()">+</button>')
        if (conversation.leader === userID) {
            groupChatButtonsDiv.append('<button class="groupChatButton" onclick="showRenameGroupChatPopup()">✍️</button>')
            groupChatButtonsDiv.append('<button class="groupChatButton" onclick="showTransferLeaderPopup()">>></button>')
        }
    }
    $('#messages').empty()
    loadTypingIndicatorArea()
    loadMessageInput()
}

function loadTypingIndicatorArea() {
    $('#messages').append(`<div id="typingIndicatorDiv"></div>`)
}

function closeConversationArea() {
    $('#messages').empty()
    openConversationID = -1
    $('#messageInputDiv').empty()
    $('#chatParticipants').empty()
    let groupChatButtonsDiv = $('#groupChatButtonsDiv')
    groupChatButtonsDiv.removeClass('active')
    groupChatButtonsDiv.empty()
}

function loadMessageInput() {
    let conversationDiv = $('#messageInputDiv')
    conversationDiv.empty()
    conversationDiv.append('<textarea id="messageInput" autofocus></textarea><button id="messageSendButton" onclick="sendMessage()"></button>')
    let messageInput = $('#messageInput')
    messageInput.on('input', function () {
        resizeMessageInput()
        let originalTyping = typing
        typing = true
        let text = messageInput.val().trim()
        if (!text || !text.trim()) typing = false
        if (typing === originalTyping) return
        sendTyping()
    })
    messageInput.focus()

    messageInput.keyup((event) => {
        if (event.key === "Enter" && !event.originalEvent.shiftKey) {
            event.preventDefault()
            sendMessage()
        }
    })
}

function sendTyping() {
    ws.send(JSON.stringify({type: Type.TYPING, conversationID: openConversationID, userID: userID, typing: typing}))
}

function resizeMessageInput() {
    let messageInput = $('#messageInput')
    messageInput.css('height', 'auto')
    messageInput.css('height', messageInput[0].scrollHeight + 'px')
    scrollToBottom()
}

function sendMessage() {
    typing = false
    let messageInput = $('#messageInput')
    let text = messageInput.val().trim()
    messageInput.val("")
    messageInput.focus()
    if (!text || !text.trim()) return
    let conversation = loadedConversations.get(openConversationID)
    if (conversation.conversationType === direct && conversation.users.filter(user => user !== userID && !loadedUsers.get(user).blocked.includes(userID)).length === 0) {
        console.log("You're blocked") // add visual
        return
    }
    if (editing === -1) {
        let message = {
            conversationID: openConversationID,
            userID: userID,
            message: text,
            replyingTo: replyingTo,
            date: new Date()
        }
        showMessage(message, true)
        ws.send(JSON.stringify({type: Type.NEWMESSAGE, message: message}))
    } else {
        let message = {
            conversationID: openConversationID,
            userID: userID,
            message: text,
            date: new Date(),
            messageID: editing
        }
        updateMessage(message)
        ws.send(JSON.stringify({type: Type.EDITMESSAGE, message: message}))
    }
    resizeMessageInput()
    closeReplyBar()
}

function showMessage(message, local) { // can remove local variable and replace with if message.userid === userid
    let name = getName(message)
    let messages = $('#messages')
    let reply = getReplyAboveText(message)
    let sendableMessage = message.message
    sendableMessage = addLinks(sendableMessage)
    if (loadedUsers.get(userID).blocked.includes(message.userID)) sendableMessage = "Message from blocked user"
    messages.append(`<div class='messageDiv' messageID=${message.messageID} userID=${message.userID} replyingTo=${message.replyingTo}>
            ${showProfilePic(message.userID, 40)}
            <div class='messageTextDiv'>
                ${reply}<p class='messageText'>${name}: ${sendableMessage}</p>
            </div>
        </div>`)
    drawShapes(`${message.userID}`, loadedUsers.get(message.userID).profilePic)
    let messageDiv = $('.messageDiv[messageID=' + message.messageID + ']')
    if (local) {
        messageDiv.addClass('myText');
        if (message.messageID === undefined) messageDiv.addClass('localMessage')
    }
    scrollToBottom()
    $('.messageDiv').contextmenu((e) => showMessageContextMenu(e))
    if (message.replyingTo !== -1) {
        messageDiv.click(function () {
            scrollToMessage(message.replyingTo)
        })
    }
}

function showServerMessage(text, messageID) {
    $('#messages').append(`<div class='messageDiv' messageID=-1 replyingTo=${messageID}><div class='messageTextDiv'><p class='messageText'>${text}</p></div></div>`)
    scrollToBottom()
}

function updateMessage(message) {
    let messageDiv = $(`.messageDiv[messageID=${message.messageID}]`)
    messageDiv.find('.messageText').text(`${loadedUsers.get(message.userID).username}: ${message.message}`)
    messageDiv.addClass('localMessage')
}

function updateMessageID(message) {
    if (loadedUsers.get(message.userID).username !== username) return
    let toSetMessageID = $('div').filter('[messageID="undefined"]').first()
    if (toSetMessageID) {
        toSetMessageID.attr('messageID', message.messageID)
        toSetMessageID.removeClass('localMessage')
    }
}

function getReplyAboveText(message) {
    if (message.replyingTo === -1) return ""
    let reply = '<p class="replyText">Replying to: '
    let replyingToDiv = $(`div[messageID="${message.replyingTo}"]`)
    if (replyingToDiv.length > 0) reply += getMessageText(replyingToDiv)
    else reply += "Deleted message"
    return reply + '</p>'
}

function getName(message) {
    let name = message.userID
    if (name) name = loadedUsers.get(name).username
    else name = username
    return name
}

function scrollToBottom() {
    let messages = $('#messages')
    if (messages.prop("scrollHeight") - (messages.scrollTop() + messages.height()) > 100) return
    messages.scrollTop(messages.prop("scrollHeight"))
}



function scrollToMessage(messageID) {
    let scrollToMessage = $(`.messageDiv[messageID=${messageID}]`)
    let messages = $('#messages')
    let targetPosition = scrollToMessage.offset().top - messages.offset().top + messages.scrollTop();
    messages.scrollTop(targetPosition);
    scrollToMessage.css('background-color', 'red')
    scrollToMessage.animate({backgroundColor: 'white'}, 500)
}

function replyMessage(messageID) {
    showReplyBar(messageID, "Reply")
    if (editing !== -1) {
        editing = -1
        $('#messageInput').val("")
    }
}

function editMessage(messageID) {
    showReplyBar(messageID, "Edit")
    $('#messageInput').val(loadedConversations.get(openConversationID).texts.find(text => text.messageID === editing).message)
}

function deleteMessage(messageID) {
    $(`.messageDiv[messageID=${messageID}]`).remove()
    ws.send(JSON.stringify({
        type: Type.DELETEMESSAGE,
        messageID: messageID,
        user: userID,
        conversationID: openConversationID
    }))
}

function showReplyBar(messageID, mode) {
    let replyBar = $('#replyBar')
    replyBar.addClass('active')
    let replyBarText
    if (mode === "Reply") {
        replyingTo = messageID
        replyBarText = $(`.messageDiv[messageID=${messageID}]`).find('p.messageText').text()
    } else if (mode === "Edit") {
        editing = messageID
        replyBarText = "Editing"
    }
    replyBar.text(replyBarText)
    replyBar.html(replyBar.html() + '<div id="replyBarCloseButton"></div>')
    $('#replyBarCloseButton').click(() => closeReplyBar())
    scrollToBottom()
    $('#messageInput').focus()
}

function closeReplyBar() {
    let replyBar = $('#replyBar')
    replyBar.removeClass('active')
    replyBar.text("")
    replyingTo = -1
    editing = -1
    $('#messageInput').focus()
}

function getMessageText(messageDiv) {
    return messageDiv.find('p.messageText').text()
}

function updateUserList(users) {
    let currentlyOnlineUsersDiv = $('#currentlyOnlineUsers')
    currentlyOnlineUsersDiv.empty()
    updateLocalUsers(users)
    data.currentlyOnlineUsers = users.filter(user => user && user.userID !== userID && !loadedUsers.get(userID).blocked.includes(user.userID))
    for (let user of users) {
        if (!user) continue
        if (user.userID === userID) continue
        if (loadedUsers.get(userID).blocked.includes(user.userID)) continue

        addToUserList(user)
    }
}

function addToUserList(user) {
    $('#currentlyOnlineUsers').append(`<button class="userBlock itemBlock" userID=${user.userID} onclick="startNewConversation(${user.userID})">
        ${showProfilePic(user.userID, 50)}
        <div class="onlineUserListButtonText">${user.username}</div>
    </button>`)
    $(`.userBlock[userID=${user.userID}]`).contextmenu((e) => showUserContextMenu(e))
    drawShapes(`${user.userID}`, loadedUsers.get(user.userID).profilePic)
}

function showCreateGroupChatPopup() {
    removeGroupChatPopup()
    showGroupChatUsersList((key, value) => key === userID, "checkbox")
    $('#activeConversationsExtraButtons').append(`<button id="groupChatCreateButton" onclick="createNewGroupChat()">Create</button>`)
}

function showInviteToGroupChatPopup() {
    removeGroupChatPopup()
    if (openConversationID === -1) return
    showGroupChatUsersList((key, value) => key === userID || loadedConversations.get(openConversationID).users.includes(key), "checkbox")
    $('#activeConversationsExtraButtons').append(`<button id="groupChatInviteButton" onclick="inviteToGroupChat()">Invite</button>`)
}

function showTransferLeaderPopup() {
    removeGroupChatPopup()
    showGroupChatUsersList((key, value) => key === userID, "radio")
    $('#activeConversationsExtraButtons').append(`<button id="groupChatTransferLeaderButton" onclick="transferLeader()">Transfer</button>`)
}

function transferLeader() {
    if (getCheckedUsers().length !== 1) return
    ws.send(JSON.stringify({
        type: Type.TRANSFERLEADER,
        conversationID: openConversationID,
        newLeader: getCheckedUsers()[0],
        originalLeader: userID
    }))
    removeGroupChatPopup()
}

function showRenameGroupChatPopup() {
    removeGroupChatPopup()
    if (openConversationID === -1) return
    $('#activeConversationsExtraButtons').append(`<input type="text" id="groupChatRenameInput"><button id="groupChatRenameButton" onclick="renameGroupChat()">Rename</button>`)
}

function showBlockedUsersPopup() {
    removeGroupChatPopup()
    showGroupChatUsersList((key, value) => !loadedUsers.get(userID).blocked.includes(key), "radio")
    $('#activeConversationsExtraButtons').append(`<button id="unblockUsersButton" onclick="unblockUsers()">Unblock</button>`)
}

function unblockUsers() {
    if (getCheckedUsers().length !== 1) return
    unblockUser(getCheckedUsers()[0])
    removeGroupChatPopup()
}

function blockUser(blockedUserID) {
    let conversationID
    $('.conversationBlock').filter((index, conversationBlock) => {
        let thisConversationID = parseInt($(conversationBlock).attr('conversationID'))
        let conversation = loadedConversations.get(thisConversationID)
        if (!conversation) return false
        let found = conversation.conversationType === direct && conversation.users.includes(blockedUserID) && conversation.users.includes(userID)
        if (found) conversationID = thisConversationID
        return found
    }).remove()
    $(`.userBlock[userID=${blockedUserID}]`).remove()
    $(`.messageDiv[userID=${blockedUserID}]`).find('p.messageText').text("Message from blocked user")
    $(`.readIndicator[userID=${blockedUserID}]`).remove()
    loadedUsers.get(userID).blocked.push(blockedUserID)
    loadedReadMessages = loadedReadMessages.filter(entry => entry.userID !== blockedUserID)
    if (conversationID === openConversationID) closeConversationArea()
    ws.send(JSON.stringify({type: Type.BLOCKUSER, userID: userID, blockedUserID: blockedUserID}))
}

function unblockUser(blockedUserID) {
    loadedUsers.get(userID).blocked = loadedUsers.get(userID).blocked.filter(userID => userID !== blockedUserID)
    addToUserList(loadedUsers.get(blockedUserID))
    if (openConversationID !== -1 && loadedConversations.get(openConversationID).users.includes(blockedUserID)) openConversation(openConversationID)
    ws.send(JSON.stringify({type: Type.UNBLOCKUSER, userID: userID, blockedUserID: blockedUserID}))
}

function inviteToGroupChat() {
    ws.send(JSON.stringify({
        type: Type.INVITETOGROUPCHAT,
        conversationID: openConversationID,
        users: getCheckedUsers()
    }))
    removeGroupChatPopup()
}

function createNewGroupChat() {
    let checkedUsers = getCheckedUsers()
    checkedUsers.push(userID)
    ws.send(JSON.stringify({
        type: Type.REQUESTCONVERSATION,
        conversationID: checkedUsers,
        conversationType: group,
        leader: userID
    })) // conversationID here is users array
    removeGroupChatPopup()
}

function renameGroupChat() {
    ws.send(JSON.stringify({
        type: Type.RENAMEGROUPCHAT,
        conversationID: openConversationID,
        newName: $('#groupChatRenameInput').val()
    }))
    removeGroupChatPopup()
}

function getCheckedUsers() {
    let users = []
    $('.groupChatUserInput:checked').each(function () {
        users.push(parseInt($(this).val()))
    })
    return users
}

function showGroupChatUsersList(condition, type) {
    removeGroupChatPopup()
    let div = $('#activeConversationsExtraButtons')
    for (let [key, value] of loadedUsers) {
        if (condition(key, value)) continue
        div.append(`<input class="groupChatUserInput" type=${type} value=${key} name="groupChatPopup"><label class="groupChatUserLabel" for="${key}">${value.username}</label>`)
    }
}

function removeGroupChatPopup() {
    $('.groupChatUserInput').remove()
    $('.groupChatUserLabel').remove()
    $('#groupChatCreateButton').remove()
    $('#groupChatInviteButton').remove()
    $('#groupChatRenameInput').remove()
    $('#groupChatRenameButton').remove()
    $('#groupChatTransferLeaderButton').remove()
    $('#unblockUsersButton').remove()
}

function logout() {
    Cookies.remove(loginCookie)
    window.location.href = '/'
}

$(window).on('focus', function () {
    $('#messageInput').focus()
})

function showUserContextMenu(e) {
    showContextMenu(e)
    let selectedUserID = getAttr(e, 'userBlock', 'userID')
    if (selectedUserID !== userID) {
        showContextButton("", 0, "Message")
        // showContextButton("blockUser", selectedUserID, "Block")
        showContextButton("showBlockUserPopup", selectedUserID, "Block")
    }
}

function showParticipantContextMenu(e) {
    showContextMenu(e)
    let participantID = getAttr(e, 'participantBlock', 'participantUserID')
    if (participantID !== userID) {
        showContextButton("", 0, "Message")
        if (!loadedUsers.get(userID).blocked.includes(participantID)) {
            // showContextButton("blockUser", participantID, "Block")
            showContextButton("showBlockUserPopup", participantID, "Block")
        }
        else {
            showContextButton("unblockUser", participantID, "Unblock")
        }
    }
    if (iAmLeader()) {
        showContextButton("removeParticipant", participantID, "Kick")
    }
}
function showContextButton(functionString, parameter, buttonText) {
    $('#contextMenu').append(`<button class="contextButton" onclick="${functionString}(${parameter})">${buttonText}</button>`)
}
function showConversationContextMenu(e) {
    showContextMenu(e)
    let conversationID = getAttr(e, 'conversationBlock', 'conversationID')
    showContextButton("removeConversation", conversationID, "Leave")
}
function showBlockUserPopup(userID) {
    showPopup()
    $('#popup').append(`<button class="popupButton" onclick=blockUser(${userID})>Confirm</button><button class="popupButton" onclick="hidePopup()">Nevermind</button>`)
    $('.popupButton').click(() => hidePopup())
}
function showPopup() {
    let popupBackground = $("#popupBackground")
    let popup = $('#popup')
    popupBackground.css('display', 'flex')
    popupBackground.click(() => hidePopup())
    popup.click(e => e.stopPropagation())
    popup.empty()
}
function hidePopup() {
    $('#popupBackground').css('display', 'none')
}
function showMessageContextMenu(e) {
    showContextMenu(e)
    let messageID = getAttr(e, 'messageDiv', 'messageID')
    showContextButton("replyMessage", messageID, "Reply")
    if ($(e.target).closest('.messageDiv').hasClass('myText')) {
        showContextButton("deleteMessage", messageID, "Delete")
        showContextButton("editMessage", messageID, "Edit")
    }
}

function getAttr(e, div, attr) {
    return parseInt($(e.target).closest(`.${div}`).attr(attr))
}

function iAmLeader() {
    if (openConversationID === -1) return false
    return loadedConversations.get(openConversationID).leader === userID
}

function showContextMenu(e) {
    e.preventDefault()
    let contextMenu = $('#contextMenu')
    contextMenu.empty()
    contextMenu.css('display', 'flex')
    contextMenu.css({left: e.pageX, top: e.pageY})
}
function startProfilePicCreator() {
    $('#profilePicCreatorBackground').css('display', 'flex')
}
function closeProfilePicCreator() {
    $('#profilePicCreatorBackground').css('display', 'none')
}
$(window).click(function () {
    contextMenuOpen = false
    $('#contextMenu').css('display', 'none')
})
function saveProfilePicture() {
    ws.send(JSON.stringify({type: Type.SAVEPROFILEPIC, userID: userID, profilePic: Object.fromEntries([...shapes])}))
    closeProfilePicCreator()
    loadedUsers.get(userID).profilePic = shapes
    drawShapes(`${userID}`, shapes)
}
function showProfilePic(userID, size) {
    return `<div class='userPic' style="clip-path: circle(${size/2}px at center);"><canvas width=${size} height=${size} canvasID=${userID}></canvas></div>`
}