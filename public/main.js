// GLITCHES
// sometimes shows duplicated users

let userID = Cookies.get(loginCookie)
let username
let ws
if (!userID) window.location.href = '/'
else {
    userID = parseInt(userID)
    connection()
}
let users = []
function connection() {
    let connectionRepeater
    ws = new WebSocket('ws://' + host + ':' + port + '/main')

    ws.onopen = () => {
        ws.send(JSON.stringify({type: Type.LOGIN, userID: userID}))
        console.log("Connected")
        clearInterval(connectionRepeater) // stops repeated reconnection attempts
    }
    ws.onclose = () => {
        connectionRepeater = setInterval(() => { // when connection broking, every 400ms, try to reconnect if possible
            if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
                console.log("Attempting to reconnect")
                connection()
            }
        }, 400)
    }
    ws.onmessage = (event) => {
        messaged(event)
    }
}
function messaged(event) {
    let message = JSON.parse(event.data)
    // console.log(message)
    let type = message.type
    switch (type) {
        case Type.ONLINEUSERSUPDATE:
            updateUserList(message.users)
            break
        case Type.RECEIVEUSERNAME:
            setUp(message.user)
            break
        case Type.BACKTOLOGIN:
            window.location.href = '/'
            break
        case Type.CONVERSATIONCREATED:
            addConversation(message.conversation)
            break
        case Type.LOADCONVERSATIONS:
            loadConversations(message.conversations)
            break
        case Type.OPENCONVERSATION:
            openConversation(message.conversation)
            break
        case Type.NEWMESSAGE:
            receivedMessage(message.message)
            break
        case Type.REQUESTCONVERSATION:
            showConversationButton(message.conversation)
            break
    }

}
function setUp(user) {
    username = user.username
    // $('#loggedInUsername').text(username)
}
function receivedMessage(message) {
    if (message.conversationID === getOpenConversation()) {
        if (message.user.username === username) updateMessageID(message)
        else showMessage(message, false)
    }
    else {
        ws.send(JSON.stringify({type: Type.REQUESTCONVERSATION, conversationID: message.conversationID}))
    }
}
function getOpenConversation() {
    return parseInt($('#conversation').attr('conversationID'))
}
function loadConversations(conversations) {
    $("#activeConversationsList").empty()
    for (let conversation of conversations) {
        showConversationButton(conversation)
    }
}
function showConversationButton(conversation) {
    let activeConversationsDiv = $("#activeConversationsList")
    if ($(`button[id=${conversation.conversationID}]`).length) return
    let id = conversation.conversationID
    let usernames = conversation.users.map(user => user.username)
    let lastMessage = conversation.texts[conversation.texts.length - 1]

    let text
    if (lastMessage) text = usernames + "<br>" + lastMessage.userID + ": " + lastMessage.message
    else text = usernames
    activeConversationsDiv.append(`
    <button class="conversationBlock" id="${id}" onclick="requestConversation(${id})">
        <div class="userPic"></div>
        <div class="activeConversationListButtonText">${text}</div>
    </button>`)
}
function addConversation(conversation) {
    $('#conversation').attr('conversationID', conversation.conversationID)
}
function openConversation(conversation) {
    $('#conversation').attr('conversationID', conversation.conversationID)
    openConversationArea()
    for (let message of conversation.texts) {
        if (message.user.username === username) showMessage(message, true)
        else showMessage(message, false)
    }
}

function openConversationArea() {
    $('#messages').empty()
    loadMessageInput()
}
function loadMessageInput() {
    let conversationDiv = $('#messageInputDiv')
    conversationDiv.empty()
    conversationDiv.append('<input id="messageInput" type="text" autofocus><button id="messageSendButton" onclick="sendMessage()"></button>')
    let messageInput = $('#messageInput')
    messageInput.keyup((event) => {
        if (event.key === "Enter") {
            event.preventDefault()
            sendMessage()
        }
    })
    messageInput.focus()
}
function sendMessage() {
    let conversationID = getOpenConversation()
    let messageInput = $('#messageInput')
    let text = messageInput.val()
    messageInput.val("")
    messageInput.focus()
    if (!text || !text.trim()) return
    let message = {conversationID: conversationID, userID: userID, message: text}
    showMessage(message, true)
    ws.send(JSON.stringify({type: Type.NEWMESSAGE, message: message}))
}
function updateMessageID(message) {
    let toSetMessageID = $('div').filter('[messageID="undefined"]').first()
    if (toSetMessageID) toSetMessageID.attr('messageID', message.messageID)
}
function showMessage(message, local) {
    let name = message.user
    if (name) name = name.username
    else name = username
    $('#messages').append(`<div class='messageDiv' messageID=${message.messageID}><p>${name}: ${message.message}</p></div>`)
    let messageDiv = $('.messageDiv[messageID=' + message.messageID + ']')
    if (local) {
        messageDiv.addClass('myText');
    }
    messageDiv.hover(function() {
        console.log("HERE")
        $(this).append(`<div>TEST</div>`)
    }, function() {
        $(this).find('div').remove()
    })
}
function requestConversation(conversationID) {
    ws.send(JSON.stringify({type: Type.OPENCONVERSATION, conversationID:conversationID}))
}
function updateUserList(users) {
    let currentlyOnlineUsersDiv = $('#currentlyOnlineUsers')
    currentlyOnlineUsersDiv.empty()

    for (let user of users) {
        if (!user) continue
        if (user.userID !== userID) currentlyOnlineUsersDiv.append(`<button class="userBlock" onclick="startNewConversation(${user.userID})"><div class="onlineUserListButtonPic"></div><div class="onlineUserListButtonText">${user.username}</div></button>`)
    }
}
function startNewConversation(user) {
    openConversationArea()
    ws.send(JSON.stringify({type: Type.STARTCONVERSATION, users: [user, userID]}))
}
