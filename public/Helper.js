let loginCookie = 'username'
let port = 6969
// let host = '192.168.2.17'
let host = 'localhost'
let Type = {
    LOGIN: 'LOGIN',
    RECEIVEUSERNAME: 'RECEIVEUSERNAME',
    ONLINEUSERSUPDATE: 'ONLINEUSERSUPDATE',

    BACKTOLOGIN: 'BACKTOLOGIN',
    LOADLOCALDATA: 'LOADLOCALDATA',
    NEWMESSAGE: 'NEWMESSAGE',
    FIRSTMESSAGE: 'FIRSTMESSAGE',
    STARTCONVERSATION: 'STARTCONVERSATION',
    REQUESTCONVERSATION: 'REQUESTCONVERSATION',
    DELETEMESSAGE: 'DELETEMESSAGE',
    EDITMESSAGE: 'EDITMESSAGE',
    CLOSECONVERSATION: 'CLOSECONVERSATION',
    CONVERSATIONCREATED: 'CONVERSATIONCREATED'
}
let direct = 0
let group = 1
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = {loginCookie, port, host, Type, direct, group};
}