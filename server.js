const express = require('express')
const Database = require('./database.js')
const app = express()
const loginServer = require('./loginServer.js')
require('express-ws')(app)
const Helper = require('./public/helper.js')

let clients = []
let typing = new Map()
Database.initPromise.then(async () => {
    await Database.deleteAll()
    await Database.createLatestIDs()
    await Database.createPublicConversation()
})
app.use(express.static('public'));
app.use(express.json());
app.ws('/main', (ws, req) => {
    ws.on('message', (msg) => {
        let data = JSON.parse(msg)
        switch (data.type) {
            case Helper.Type.LOGIN:
                login(ws, data.userID)
                break
            case Helper.Type.STARTCONVERSATION:
            case Helper.Type.REQUESTCONVERSATION:
                sendRequestedConversation(ws, data.conversationID, data.conversationType, data.type)
                break
            case Helper.Type.NEWMESSAGE:
                receivedMessage(data.message)
                break
            case Helper.Type.DELETEMESSAGE:
                deleteMessage(data)
                break
            case Helper.Type.EDITMESSAGE:
                editMessage(data.message)
                break
            case Helper.Type.CLOSECONVERSATION:
                closeConversation(data)
                break
            case Helper.Type.INVITETOGROUPCHAT:
                inviteToGroupChat(data)
                break
            case Helper.Type.RENAMEGROUPCHAT:
                renameGroupChat(data)
                break
            case Helper.Type.READMESSAGE:
                readMessage(data)
                break
            case Helper.Type.TYPING:
                updateTyping(data)
                break
            case Helper.Type.REQUESTTYPING:
                sendTyping(ws, data.conversationID)
                break
        }
    })
    ws.on('close', () => disconnect(ws))
})
function disconnect(ws) {
    for (let i = 0; i < clients.length; i++) {
        if (clients[i].socket === ws) {
            clients.splice(i, 1)
            updateUserLists()
            return
        }
    }
}
function login(ws, userID) {
    Database.findUserWithID(userID).then((user) => {
        if (!user) {
            ws.send(JSON.stringify({type: Helper.Type.BACKTOLOGIN}))
            return
        }
        console.log(user.username + " logged in")
        clients.push({socket: ws, userID: userID})
        ws.send(JSON.stringify({type: Helper.Type.RECEIVEUSERNAME, user: user}))
        loadLocalData(ws, user)
        updateUserLists()
    })
}
function updateTyping(data) {
    if (!typing.has(data.conversationID)) typing.set(data.conversationID, [])
    let conversationTyping = typing.get(data.conversationID)
    if (!data.typing) conversationTyping.splice(conversationTyping.indexOf(data.userID), 1)
    else conversationTyping.push(data.userID)
    Database.findConversation(data.conversationID).then((conversation) => {
        for (let userID of conversation.users) {
            let client = clients.find(client => client.userID === userID)
            if (!client) continue
            sendTyping(client.socket, data.conversationID)
        }
    })
}
function sendTyping(ws, conversationID) {
    if (!typing.has(conversationID)) ws.send(JSON.stringify({type: Helper.Type.TYPING, conversationID: conversationID, conversationTyping: []}))
    else ws.send(JSON.stringify({type: Helper.Type.TYPING, conversationID: conversationID, conversationTyping: typing.get(conversationID)}))
}
function sendRequestedConversation(ws, conversationID, conversationType, type) { // conversationID can be users array
    Database.findConversation(conversationID).then(async (conversation) => {
        if (!conversation && conversationType === Helper.direct) conversation = await Database.findConversationWithUsers(conversationID)
        if (!conversation) {
            conversation = await Database.createConversation(conversationID, conversationType)
            type = Helper.Type.CONVERSATIONCREATED
        }
        ws.send(JSON.stringify({type: type, conversation: conversation}))
    })
}
function inviteToGroupChat(data) {
    console.log(data)
    Database.addUsersToGroupChat(data.conversationID, data.users).then((conversation) => {
        for (let userID of conversation.users) {
            let client = clients.find(client => client.userID === userID)
            if (!client) continue
            client.socket.send(JSON.stringify({type: Helper.Type.INVITETOGROUPCHAT, conversation: conversation})) // can be optimized
        }
        Database.findUsersWithID(data.users).then(users => {
            for (let user of users) sendServerMessage(data.conversationID, user.username + " just joined")
        })
    })

}
function sendServerMessage(conversationID, text) {
    Database.addServerMessage(text, conversationID).then(conversation => {
        let messageID = conversation.texts[conversation.texts.length - 1].messageID
        for (let userID of conversation.users) {
            let client = clients.find(client => client.userID === userID)
            if (!client) continue
            client.socket.send(JSON.stringify({type: Helper.Type.NEWSERVERMESSAGE, text: text, conversationID: conversationID, messageID: messageID}))
        }
    })
}
function renameGroupChat(data) {
    Database.renameGroupChat(data.conversationID, data.newName).then((conversation) => {
        for (let userID of conversation.users) {
            let client = clients.find(client => client.userID === userID)
            if (!client) continue
            client.socket.send(JSON.stringify({type: Helper.Type.RENAMEGROUPCHAT, conversation: conversation})) // can be optimzied
        }
    })
}
function closeConversation(data) {
    Database.findConversation(data.conversationID).then((originalConversation) => {
        Database.closeConversation(data.userID, data.conversationID, data.conversationType).then((conversation) => {
            if (!conversation || conversation === Helper.direct) return
            for (let userID of originalConversation.users) {
                let client = clients.find(client => client.userID === userID)
                if (!client) continue
                client.socket.send(JSON.stringify({type: Helper.Type.CLOSECONVERSATION, conversation: conversation, userID: data.userID}))
            }
            if (data.conversationType === Helper.group) {
                Database.findUserWithID(data.userID).then(user => sendServerMessage(data.conversationID,user.username + " just left"))
            }
        })

    })


}
function editMessage(message) {
    updateTyping({conversationID: message.conversationID, userID: message.userID, typing: false})
    Database.editMessage(message.conversationID, message.messageID, message.message).then((conversation) => {
        for (let userID of conversation.users) {
            let client = clients.find(client => client.userID === userID)
            if (!client) continue
            client.socket.send(JSON.stringify({type: Helper.Type.EDITMESSAGE, message: {conversationID: message.conversationID, userID: message.userID, messageID: message.messageID, message: message.message}}))
        }
    })
}
function deleteMessage(data) {
    Database.deleteMessage(data.conversationID, data.messageID).then((conversation) => {
        for (let userID of conversation.users) {
            let client = clients.find(client => client.userID === userID)
            if (!client) continue
            client.socket.send(JSON.stringify({type: Helper.Type.DELETEMESSAGE, messageID: data.messageID})) // why doesn't this send conversationid? check for glitches
        }
    })
}
function receivedMessage(message) {
    updateTyping({conversationID: message.conversationID, userID: message.userID, typing: false})
    Database.addMessage(message).then((conversation) => {
        message.messageID = conversation.texts[conversation.texts.length - 1].messageID
        for (let userID of conversation.users) {
            let client = clients.find(client => client.userID === userID)
            if (!client) continue
            if (conversation.texts.length === 1) client.socket.send(JSON.stringify({type: Helper.Type.FIRSTMESSAGE, message: message, conversation: conversation}))
            else client.socket.send(JSON.stringify({type: Helper.Type.NEWMESSAGE, message: message}))
        }
    })
}
function readMessage(data) {
    Database.updateReadMessages([data.userID], data.conversationID, data.messageID).then(() => {
        Database.findConversation(data.conversationID).then((conversation) => {
            for (let userID of conversation.users) {
                let client = clients.find(client => client.userID === userID)
                if (!client) continue
                client.socket.send(JSON.stringify({type: Helper.Type.READMESSAGE, conversationID: data.conversationID, userID: data.userID, messageID: data.messageID}))
            }
        })
    })

}

function loadLocalData(ws, user) {
    if (!user) return
    Database.findConversations(user.conversations).then((conversations) => {
        if (!conversations) return
        conversations = conversations.filter(conversation => conversation)
        let userIDs = new Set(conversations.flatMap(conversation => conversation.users))
        Database.findUsersWithID(Array.from(userIDs)).then((users) => {
            Database.getReadMessages(conversations.map(conversation => conversation.conversationID)).then((readMessages) => {
                ws.send(JSON.stringify({type: Helper.Type.LOADLOCALDATA, conversations: conversations, users: users, readMessages: readMessages}))
            })

        })
    })

}

function updateUserLists() {
    Database.findUsersWithID(clients.map(client => client.userID)).then((users) => {
        for (let client of clients) {
            Database.findUserWithID(client.userID).then((user) => { // very very inefficient
                loadLocalData(client.socket, user)
            })
            client.socket.send(JSON.stringify({type: Helper.Type.ONLINEUSERSUPDATE, users: users}))
        }
    })
}

app.get('/main', (req, res) => {
    res.sendFile(__dirname + '/public/main.html')
})
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/login.html')
})

app.use('/', loginServer)
app.listen({port: Helper.port, host: Helper.host}, () => {
    console.log("Server started")
})