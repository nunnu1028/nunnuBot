const { config } = require("../config.js");
const { WordRelayCommand, WordRelayGameCommand } = require("./handler/word-relay.js");
const { KakaoTalkBot } = require("./modules/bot.js");

let bot = new KakaoTalkBot(config.device_name, config.device_uuid, "!");
bot.login(config.email, config.password).then(res => {
    if (res.client_login) {
        console.log("[#] Login And Connect Success!");
        bot.addHandler(new WordRelayCommand());
        bot.addHandler(new WordRelayGameCommand());
    }
});