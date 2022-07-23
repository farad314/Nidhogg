"use strict";


var usr = {
    name: null,
    chats: null,
    uuid: "F00DD4A2-7251-4B83-BFDE-6C9F75B9EB02"
};
var chats = {};
var wsurl = "ws://127.0.0.1:8080";
var ls = {};
var connected = false;
var contime = 0;
self.ws = null;
var locked = false;

// Tool Functions
function initws() {
    self.ws = new WebSocket(wsurl);
    self.ws.onopen = function open() {
        connected = true;
        self.ws.send('{"Type":"Login","body":{"id":"' + usr.uuid + '"}}');
        console.debug("[VERBOSE][WS]: Connected");
        return false;
    };
    self.ws.parser = new WsParser();
    self.ws.onmessage = (e) => {
        self.ws.parser.main(e.data);
        return false;
    };
    self.ws.onclose = (e) => {
        self.ws.reconnect(wsurl);
        var abnormal = e.code > 1001 && e.code != 1005 && e.code != 1012 && e.code != 1013;
        if (abnormal) {
            console.error("[ERROR][CONNECTION CLOSED]: Code ", e.code);
            Disconnected();
        }
        else console.log("[INFO][CONNECTION CLOSED]: Code ", e.code);
    };
    self.ws.onerror = function (e) {
        self.ws.reconnect(wsurl);
        console.warn("[WARN][CONNECTION ERROR]: ",e);
    };

    self.ws.reconnect = (url) => {
        if (locked) {
            setTimeout(function () {
                self.ws.reconnect(url);
            }, 1000);
            return;
        }
        locked = true;
        initws(url);
        console.log("[INFO][RECONNECT]: Start");
        setTimeout(function () {     //没连接上会一直重连，设置延迟避免请求过多
            locked = false;
        }, 15000);
    }
}
function login(
    uuid = "F00DD4A2-7251-4B83-BFDE-6C9F75B9EB02",
    safe = true
) {
    if (uuid.type) uuid = "F00DD4A2-7251-4B83-BFDE-6C9F75B9EB02";
    usr.uuid = uuid;
    if (self.ws) {
        if (self.ws.readyState > 1) initws();
    } else {
        initws(uuid);
    }
    console.log("[INFO][LOGIN]: Start");
    if (safe) setls("usr", uuid);
}

function getchat(uuid = false) {
    console.log("[INFO][GETCHAT]: Start");
    if (!uuid)
        for (const i in chats) {
            if (!chats[i].chat) {
                self.ws.send('{"Type":"Request","body":{"id":"' + i + '"}}');
            }
        }
    else {
        self.ws.send('{"Type":"Request","body":{"id":"' + uuid + '"}}');
    }
}
function ServerErr() {
    console.warn("[WARN][SERVER]: Error on processing Request");
}
function NoUsr() {
    notify("异常", { body: "登录失败，请尝试重新登录" });
}
function JSONErr() {
    console.warn("[WARN][SERVER]: Error on Parsing JSON");
}
function NotReady() {
    self.postMessage({
        "action": "focus",
        "body": {
            "data": "请稍候，连接尚未建立"
        }
    });
}
function sendMsg(chat, type, msg) {
    self.ws.send(
        '{"Type":"Send","body":{"id":"' +
        chat +
        '","type":"' +
        type +
        '","data":"' +
        msg +
        '"}}'
    );
}
function NotLoggedIn() {
    self.postMessage({
        "action": "focus",
        "body": {
            "data": "错误：服务器端无登录信息，请先登录"
        }
    });
}
function NewMsg(chat, tag, data, icon = null) {
    var opt = { body: tag + ": " + data };
    if (icon) {
        opt.image = icon;
    }
    if (tag != "self") notify(chat, opt);
}
function Disconnected() {
    if (!connected) return;
    time = new Date();
    if (time.getTime() < contime + 1800000) return;
    contime = time.getTime();
    notify("已离线", { body: "连接断开，点我重试", silent: true }, login);
}
function notify(msg, opt = { body: "" }, oncli = () => { self.postMessage({ "action": "focus" }); }) {
    var noti = null;
    try {
        console.assert(Notification, "[WARN][NOTIFY]: Notification is not exist");
    } catch (e) {
        return;
    }
    if (Notification.permission === "granted") {
        opt.lang = "zh-cn";
        noti = new Notification(msg, opt);
        noti.onclick = oncli;
    } else {
        if (Notification.permission !== "denied") console.warn("[WARN][NOTIFY]: Notification Failed");
        else console.debug("[VERBOSE][NOTIFY]: Notification Denied");
        self.postMessage({ action: "NotiRequest" });
    }
}
self.onmessage = function (e) {
    switch (e.data.action) {
        case "login":
            login(e.data.body.id);
            break;
        case "ls":
            ls.NotifyRequested = e.data.body.NotifyRequested;
            ls.usr = e.data.body.usr;
            break;
        default:
            console.warn("[WARN][WORKER]: Unknown Command: " + e.data);
            break;
    }
}
function setls(key, val) {
    self.postMessage({
        action: "ls",
        body: {
            key: key,
            val: val
        }
    });
}

// Main Parser
class parseFeedback {
    constructor() {
    }
    main(msg) {
        if (msg.Error == "Success") {
            console.debug("[VERBOSE][SERVER]: Success");
            self.postMessage({action:"success", body: {pos: msg.pos,data: chats}});
            if (msg.body.pos[0] == "login") getchat();
        } else if (msg.Error == "No Data") {
            if (msg.body.pos[0] == "login") {
                ls.usr = undefined;
                NoUsr();
            }
            if (msg.body.pos[0] == "Send") {
                NotLoggedIn();
            }
            console.warn("[WARN][SERVER]: No Data");
        } else if (msg.Error == "Server") ServerErr();
        else if (msg.body)
            switch (msg.body.pos[0]) {
                case "usr":
                    this.usr(msg);
                    break;
                case "chat":
                    this.chat(msg);
                    break;
                default:
                    break;
            }
    }
    usr(msg) {
        usr[msg.body.pos[1]] = msg.body.data;
        console.debug(
            "[VERBOSE][LOGIN]: " + msg.body.pos[1] + " received: ",
            msg.body.data
        );
        if (msg.body.pos[1] == "chats")
            for (let i = 0; i < msg.body.data.length; i++)
                chats[msg.body.data] = {
                    name: null,
                    chat: null,
                };
    }
    chat(msg) {
        console.debug(
            "[VERBOSE][GETCHAT]: Data " +
            msg.body.pos[1] +
            " of chat " +
            msg.body.id +
            " received: ",
            msg.body.data
        );
        chats[msg.body.id][msg.body.pos[1]] = msg.body.data;
    }
}
class WsParser{
    constructor() {
        this.feedback = new parseFeedback();
    }
    main(data) {
        var msg = JSON.parse(data);
        console.debug("[VERBOSE][DATA] Received:", msg);
        if (msg.Error == "JSON") JSONErr();
        switch (msg.Type) {
            case "Update":
                this.update(msg);
                break;
            case "Feedback":
                this.feedback.main(msg);
                break;
            case "Debug":
                console.debug("[VERBOSE][SERVER DEBUG]: ", msg.body);
            default:
                break;
        }
    }
    update(msg) {
        NewMsg(chats[msg.body.id].name, msg.body.tag, msg.body.data);
        console.log("[INFO][MSG]: Update");
        getchat(msg.body.id);
    }

}
