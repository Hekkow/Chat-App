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
    DELETEMESSAGE: 'DELETEMESSAGE'
}
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = {loginCookie, port, host, Type};
}