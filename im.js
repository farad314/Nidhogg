"use strict";

// Import
const WebSocket = require('ws');
const fs = require('fs');
const { time } = require('console');

// Tool Functions
function json2obj(filename) {
    return JSON.parse(fs.readFileSync(filename).toString());
}
function safe() {
    for (const i in chatlist) {
        if (i == 'dir') continue;
        if (i == 'list') continue;
        var obj = { ...chatlist[i] };
        delete obj.online;
        delete obj.file;
        fs.writeFileSync(chatlist.dir + chatlist[i].file, JSON.stringify(obj));
    }
    fs.writeFileSync('./config.json', JSON.stringify(config));
}
function archive() {
    var tim = new Date();
    if (Math.floor(time.getTime() / 86400000) <= lastArchive) return;
    for (const i in chatlist) {
        if (i == 'dir') continue;
        if (i == 'list') continue;
        if (!chatlist[i].archive) chatlist[i].archive = [];
        chatlist[i].archive.push(chatlist[i].chat);
        time = new Date();
        chatlist[i].chat = [
            { "user": "", "time": time.getTime(), "body": { "type": "object", "data": {"html":'<div class="archivesign"></div>'} } }];
        delete obj.online;
        delete obj.file;
        fs.writeFileSync(chatlist.dir + chatlist[i].file, JSON.stringify(obj));
    }
    config.lastArchive = lastArchive;
    safe();
}
function exit_safe() {
    if (!state) return;
    for (let i = 0; i < connected.length; i++) {
        connected[i].close(1012);
    }
    online = [];
    safe();
    state = false;
    process.kill(process.pid, 'SIGTERM');
}

// Vars
var state = true
var config = json2obj('config.json');
var lastArchive = config.lastArchive;
var chatlist = json2obj(config.fsPos.chatlist);
var userlist = json2obj(config.fsPos.userlist);
for (let i = 0; i < chatlist.list.length; i++) {
    var a = json2obj(chatlist.dir + chatlist.list[i]);
    chatlist[a.uuid] = a;
    chatlist[a.uuid].file = chatlist.list[i];
    chatlist[a.uuid].online = [];
}
for (let i = 0; i < userlist.list.length; i++) {
    var a = userlist.list[i]
    userlist.list[i] = json2obj(userlist.dir + userlist.list[i]);
    userlist.list[i].file = a;
}
var online = [];
var connected = [];
var i18n = {
    'msgtype': {
        'text': "文字",
        'img': "图片",
        'file': "文件",
        'object': "特殊消息",
    }
}
var blacklist = {

}
// WebSocket
const wss = new WebSocket.Server({ port: 8080 });
//创建一个WebSocketServer的实例，监听端口8080

wss.on('connection', function connection(ws, req) {
    ws.ip = req.socket.remoteAddress;
    if (ws.ip in blacklist) {
        var time = new Date();
        // if (time.getTime() < blacklist[ws.ip] + 300000) ws.close(1013);
        // else delete blacklist[ws.ip];
    }
    console.log('connection on: ' + ws.url);
    ws.usr = null;
    ws.chance = 0;
    connected.push(ws);
    ws.on('message', function incoming(message) {
        if (message == '{"Type":"Check"}') return;
        if (ws.usr) {
            console.log('msgby: ', ws.usr);
            ws.send('{ "Type": "Debug","body":' + JSON.stringify(ws.usr) + '}');
        }
        try {
            try {
                var data = JSON.parse(message);
            } catch (err) {
                ws.send('{ "Type": "Feedback", "Error": "JSON" }');
                return;
            }
            switch (data.Type) {
                case "Send":
                    // Get a Msg
                    if (ws.usr && chatlist[data.body.id]) {
                        var time = new Date();
                        chatlist[data.body.id].chat.push({
                            "user": ws.usr.uuid,
                            "time": time.getTime(),
                            "body": {
                                "type": data.body.type,
                                "data": data.body.data
                            }
                        })
                        ws.send('{ "Type": "Feedback", "Error": "Success", "body":{"pos":["Send"]}}');
                        /*
                            Type: Feedback
                            Error: Success
                            body:
                                pos:
                                    - Send
                        */
                        for (let i = 0; i < chatlist[data.body.id].online.length; i++) {
                            // Notify

                            // Vars
                            var tag = (chatlist[data.body.id].online[i].usr.uuid == ws.usr.uuid) ? ("self") : (ws.usr.username);
                            // tag = self | username
                            var datamain = (data.body.type.toLowerCase() == "text") ? (data.body.data) : ("[" + i18n.msgtype[data.body.type.toLowerCase()] + "]");
                            // data = data.body.data | [typename in chinese]

                            chatlist[data.body.id].online[i].send('{ "Type": "Update", "body":{"id":"' + data.body.id + '","tag":"' + tag + '","data":"' + datamain + '"}}');
                            /*
                                Type: update
                                body:
                                    id: data.body.id
                                    tag: tag
                                    data: data
                            */
                            console.debug("[VERBOSE][MSG]: Notified " + chatlist[data.body.id].online[i].usr.uuid + "(" + chatlist[data.body.id].online[i].usr.username + ")");
                        }
                        return;
                    }
                    ws.send('{ "Type": "Feedback", "Error": "No Data", "body":{"pos":["Send"]}}');
                    /*
                        Type: Feedback
                        Error: No Data
                        body:
                            pos: Send
                    */
                    return;
                case "Request":
                    // Requesting chat history
                    if (chatlist[data.body.id]) {
                        ws.send('{ "Type": "Feedback", "body":{"type":"Text","pos":["chat","name"],"id":"' + data.body.id + '","data":"' + chatlist[data.body.id].name + '"}}')
                        /*
                            Type: Feedback
                            body:
                                type: Text
                                pos:
                                    - chat
                                    - name
                                id: data.body.id
                                data: chatlist[data.body.id].name
                        */

                        ws.send('{ "Type": "Feedback", "body":{"type":"object","pos":["chat","chat"],"id":"' + data.body.id + '","data":' + JSON.stringify(chatlist[data.body.id].chat) + '}}')
                        /*
                            Type: Feedback
                            body:
                                type: Text
                                pos:
                                    - chat
                                    - chat
                                id: data.body.id
                                data: chatlist[data.body.id].chat
                        */
                        if (chatlist[data.body.id].icon) ws.send('{ "Type": "Feedback", "body":{"type":"object","pos":["chat","icon"],"id":"' + data.body.id + '","data":"' + chatlist[data.body.id].icon + '"}}')
                        /*
                            Type: Feedback
                            body:
                                type: Text
                                pos:
                                    - chat
                                    - icon
                                id: data.body.id
                                data: chatlist[data.body.id].icon
                        */

                        ws.send('{ "Type": "Feedback", "Error": "Success", "body":{"pos":["Request"]}}');
                        /*
                            Type: Feedback
                            Error: Success
                            body:
                                pos:
                                    - Request
                        */
                        return;
                    }
                    ws.send('{ "Type": "Feedback", "Error": "No Data", "body":{"pos":["Request"]}}');
                    /*
                        Type: Feedback
                        Error: No Data
                        body:
                            pos:
                                - Request
                    */
                    return;
                case "Login":
                    // loging in
                    if (ws.chance >= 3) {
                        ws.send('{ "Type": "Feedback", "Error": "No Data", "body":{"pos":["login"],"data":"You have tried to log in for more than three times, please try to log in after 5 minutes. The connection will be automatically disconnected"}}');
                        time = new Date();
                        blacklist[ws.ip] = time.getTime();
                        ws.close(1013);
                    }
                    for (let i = 0; i < userlist.list.length; i++) {
                        if (userlist.list[i].uuid == data.body.id) {
                            ws.usr = userlist.list[i];
                            ws.send('{ "Type": "Feedback", "body":{"type":"Text","pos":["usr","name"],"data":"' + userlist.list[i].username + '"}}')
                            /*
                                Type: Feedback
                                body:
                                    Type: Text
                                    pos:
                                        - usr
                                        - name
                                    data: userlist.list[i].username
                            */

                            ws.send('{ "Type": "Feedback", "body":{"type":"object","pos":["usr","chats"],"data":' + JSON.stringify(userlist.list[i].chats) + '}}')
                            /*
                                Type: Feedback
                                body:
                                    Type: object
                                    pos:
                                        - usr
                                        - chats
                                    data: userlist.list[i].chats
                            */

                            // Mark as online
                            for (let j = 0; j < userlist.list[i].chats.length; j++)
                                if (chatlist[userlist.list[i].chats[j]]) {
                                    chatlist[userlist.list[i].chats[j]].online.push(ws);
                                }

                            ws.send('{ "Type": "Feedback", "Error": "Success", "body":{"pos":["login"]}}');
                            /*
                                Type: Feedback
                                Error: Success
                                body:
                                    pos:
                                        - login
                            */
                            online.push(ws);
                            return;
                        }
                    }
                    ws.send('{ "Type": "Feedback", "Error": "No Data", "body":{"pos":["login"]}}');
                    ws.chance += 1;
                    /*
                        Type: Feedback
                        Error: No Data
                        body:
                            pos:
                                - login
                    */
                    return;
                case "Debug":
                    console.log(data.body);
                    return;
                case "Check":
                    return;
                default:
                    break;
            }
            if (data = { archive: true }) archive();
            console.log('received: %s', message);
            ws.send('{ "Type": "Feedback", "Error": "No Data" }');
        } catch (err) {
            try {
                ws.send('{ "Type": "Feedback", "Error": "Server" }');
            } finally {
                console.warn(err);
            }
        }
    });
    ws.on('close', function () {
        // loging out

        // Remove in online
        for (let i = 0; i < online.length; i++)
            if (online[i] === ws) {
                online.splice(i, 1);
                break;
            }
        // Remove in connected
        for (let i = 0; i < connected.length; i++)
            if (connected[i] === ws) {
                connected.splice(i, 1);
                break;
            }
        // Remove in chat
        if (ws.usr) for (let i = 0; i < ws.usr.chats.length; i++)
            if (chatlist[ws.usr.chats[i]])
                for (let j = 0; j < chatlist[ws.usr.chats[i]].online.length; j++)
                    if (chatlist[ws.usr.chats[i]].online[j] === ws) {
                        connected.splice(i, 1);
                        break;
                    }
        console.log("disconnected")
    })
});

setInterval(safe, 1000 * 60 * 10); // safe every 10 minutes
setInterval(archive(), 1000 * 60 * 60 * 3); // chack archive every 3 hour, archive every day
archive();// chack when initialization complete
process.on('SIGTERM', exit_safe)
process.on('SIGKILL', exit_safe)
