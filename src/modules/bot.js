const { AuthApiClient, TalkClient, KnownAuthStatusCode } = require("node-kakao");

class AuthClient {
    constructor(device_name, device_uuid) {
        this.authApiClient = null;
        this.device_name = device_name;
        this.device_uuid = device_uuid;
    }

    createLoginForm(email, password, permanent = true, forced = undefined) {
        let loginForm = { email, password, permanent };
        if (typeof forced === "boolean") loginForm["forced"] = forced;

        return loginForm;
    }

    createRequestForm(email, password, permanent = true, me_user = false) {
        let requestForm = { email, password, permanent };
        if (typeof me_user === "boolean") loginForm["me_user"] = me_user;

        return requestForm;
    }

    async login(email, password, permanent = true, forced = undefined, relogin = false) {
        this.authApiClient = await AuthApiClient.create(this.device_name, this.device_uuid);
        let loginForm = this.createLoginForm(email, password, permanent, forced);
        let loginRes = await this.authApiClient.login(loginForm);
        if (loginRes.success) {
            this.client = new TalkClient();
            let client_loginRes = await this.client.login(loginRes.result);
            return { "client_login_res": client_loginRes, "api_res": loginRes, "register": false, "relogin": relogin, "client_login": true, "client": this.client };
        } else {
            if (relogin) return { "client_login_res": undefined, "api_res": loginRes, "register": false, "relogin": true, "client_login": false, "client": this.client };
            if (loginRes.status === KnownAuthStatusCode.DEVICE_NOT_REGISTERED) {
                let regisetRes = await this.registerDevice(email, password, permanent);
                if (regisetRes.success) return this.login(email, password, permanent, forced, true);
                return { "client_login_res": undefined, "api_res": registerRes, "register": true, "relogin": false, "client_login": false, "client": this.client };
            }

            return { "client_login_res": undefined, "api_res": loginRes, "register": false, "relogin": false, "client_login": false, "client": this.client };
        }
    }

    async registerDevice(email, password, permanent = true, me_user = false) {
        this.authApiClient = await AuthApiClient.create(this.device_name, this.device_uuid);
        let requestForm = this.createRequestForm(email, password, permanent, me_user);
        let requestRes = await this.authApiClient.requestPasscode(requestForm);
        if (requestRes.success) {
            let readline = require("readline");
            let readline_interface = readline.createInterface({ input: process.stdin, output: process.stdout });
            let passcode = await new Promise(reslove => readline_interface.question("passcode: ", reslove));
            readline_interface.close();

            let registerForm = this.createLoginForm(email, password, permanent);
            return this.authApiClient.registerDevice(registerForm, passcode);
        }

        return loginRes;
    }
}

class KakaoTalkBot {
    constructor(device_name, device_uuid, prefix) {
        this.client = null;
        this.authClient = new AuthClient(device_name, device_uuid);
        this.handlerList = [];
        this.extraObj = {};
        this.prefix = prefix;
        this.device_name = device_name;
        this.device_uuid = device_uuid;
    }

    async login(email, password, permanent = true, forced = undefined) {
        let loginRes = await this.authClient.login(email, password, permanent, forced);
        if (loginRes.api_res.success) {
            this.client = loginRes.client;
            this.addClientHandler();
        }
        return loginRes;
    }

    addClientHandler() {
        this.client.on("chat", (chat, channel) => {
            let obj = {
                chat,
                channel,
                client: this.client,
                extraObj: this.extraObj
            };
            this.handlerList.forEach(handler => {
                try {
                    if (handler.isCommand) {
                        if (chat.text[0] === this.prefix && chat.text.startsWith(`${this.prefix + handler.command}`)) {
                            if (chat.text[(this.prefix + handler.command).length] === undefined || chat.text[(this.prefix + handler.command).length] === " ") {
                                if (chat.text.split(" ").length > handler.command.split(" ").length) {
                                    handler.runArg(obj);
                                } else {
                                    handler.run(obj);
                                }
                            }
                        }
                    } else {
                        handler.run(obj);
                    }
                } catch (e) {
                    console.log(e);
                }
            });
        });
    }

    addHandler(handler) {
        this.handlerList.push(handler);
    }

    addOtherHandler(event_name, func) {
        this.client.on(event_name, func);
    }
}

module.exports = { KakaoTalkBot };