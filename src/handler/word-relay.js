const { default: axios } = require("axios");
const { ChatBuilder, AttachmentApi, KnownChatType } = require("node-kakao");
const { Handler } = require("../modules/handler.js");

class WordRelayCommand extends Handler {
    constructor() {
        super(true, "끝말잇기");
    }

    initChannel(obj) {
        obj.extraObj["wordRelay"] = {};
        obj.extraObj["wordRelay"][obj.channel.channelId] = {
            roomList: []
        };
    }

    isExistsUser(obj) {
        let result = { "room": undefined, "isExists": false };
        let extraObj = obj.extraObj;
        if (!extraObj["wordRelay"] || !extraObj["wordRelay"][obj.channel.channelId]) this.initChannel(obj);
        let roomList = extraObj.wordRelay[obj.channel.channelId].roomList;

        roomList.forEach(room => {
            room.userList.forEach(user => {
                if (user.userId.toString() === obj.chat.chat.sender.userId.toString()) result = { "room": room, "isExists": true };
            });
        });

        return result;
    }

    isMasterUser(obj) {
        let result = { "room": undefined, "isMaster": false };
        let extraObj = obj.extraObj;
        if (!extraObj["wordRelay"] || !extraObj["wordRelay"][obj.channel.channelId]) this.initChannel(obj);
        let roomList = extraObj.wordRelay[obj.channel.channelId].roomList;

        roomList.forEach(room => {
            if (room.userList[0].userId.toString() === obj.chat.chat.sender.userId.toString()) result = { "room": room, "isMaster": true };
        });

        return result;
    }

    isExistsRoom(obj) {
        let result = { "room": undefined, "isExists": false };
        let extraObj = obj.extraObj;
        if (!extraObj["wordRelay"] || !extraObj["wordRelay"][obj.channel.channelId]) this.initChannel(obj);
        let roomList = extraObj.wordRelay[obj.channel.channelId].roomList;

        if (roomList.length > parseInt(obj.chat.text.split(" ")[2])) {
            result.isExists = true;
            result.room = roomList[parseInt(obj.chat.text.split(" ")[2])];
        }

        return result;
    }

    isMyTurn(obj) {
        let extraObj = obj.extraObj;
        if (!extraObj["wordRelay"] || !extraObj["wordRelay"][obj.channel.channelId]) this.initChannel(obj);
        let room = this.isExistsUser(obj).room;

        if (room.userList[room.turnCount].userId.toString() === obj.chat.chat.sender.userId.toString()) return true;
        return false;
    }

    async replyRoomList(obj) {
        let extraObj = obj.extraObj;
        if (!extraObj["wordRelay"] || !extraObj["wordRelay"][obj.channel.channelId]) this.initChannel(obj);
        let roomList = extraObj.wordRelay[obj.channel.channelId].roomList;

        if (roomList.length === 0) {
            obj.channel.sendChat("[#] 끝말잇기 방이 없습니다.");
        } else {
            let roomInfos = [];
            roomList.forEach(room => {
                let userNicknames = [];
                room.userList.forEach(user => {
                    let userInfo = obj.channel.getUserInfo(user);
                    if (!userInfo) userNicknames.push("unknown");
                    else userNicknames.push(userInfo.nickname);
                });
                let roomInfo = "";
                roomInfo += room.number + " 번방: [";
                roomInfo += "\n  방 번호: " + room.number;
                roomInfo += "\n  방 방장: " + userNicknames[0];
                roomInfo += "\n  방 시작여부: " + room.isStarted.toString();
                roomInfo += "\n  방 유저 목록: [";
                roomInfo += "\n    " + userNicknames.join(",\n    ");
                roomInfo += "\n  ]";
                roomInfo += "\n]";

                roomInfos.push(roomInfo);
            });

            let attachment = await AttachmentApi.upload(KnownChatType.TEXT, "bot", Buffer.from(roomInfos.join("\n\n")));
            let builder = new ChatBuilder();
            builder.attachment(attachment.result);
            builder.text("[#] 끝말잇기 방 목록입니다. 클릭하여 확인해주세요.");

            obj.channel.sendChat(builder.build(KnownChatType.TEXT));
        }
    }

    createRoom(obj) {
        let extraObj = obj.extraObj;
        if (!extraObj["wordRelay"] || !extraObj["wordRelay"][obj.channel.channelId]) this.initChannel(obj);
        let roomList = extraObj.wordRelay[obj.channel.channelId].roomList;

        if (this.isExistsUser(obj).isExists) {
            obj.channel.sendChat("[#] 이미 끝말잇기 방에 참가되어 있습니다. 방을 만드시려면 참가된 방에서 나가주세요.");
        } else {
            roomList.push({ number: roomList.length.toString(), userList: [obj.chat.chat.sender], isStarted: false, turnCount: 0, isFirst: true, timer: null, words: [] });
            obj.channel.sendChat(`[#] 끝말잇기 방이 생성되었습니다. 방 번호는 ${(roomList.length - 1).toString()} 입니다.`);
        }
    }

    joinRoom(obj) {
        let extraObj = obj.extraObj;
        if (!extraObj["wordRelay"] || !extraObj["wordRelay"][obj.channel.channelId]) this.initChannel(obj);
        let roomList = extraObj.wordRelay[obj.channel.channelId].roomList;

        if (this.isExistsRoom(obj).isExists) {
            if (this.isExistsUser(obj).isExists) {
                obj.channel.sendChat("[#] 이미 끝말잇기 방에 참가되어 있습니다. 다른 방에 참가하시려면 참가된 방에서 나가주세요.");
            } else {
                let room = this.isExistsRoom(obj).room;
                if (room.isStarted) {
                    obj.channel.sendChat("[#] 끝말잇기 방의 게임이 시작되어있습니다.");
                } else {
                    room.userList.push(obj.chat.chat.sender);
                    obj.channel.sendChat(`[#] 끝말잇기 방에 참가되었습니다. 방 번호는 ${(roomList.length - 1).toString()} 입니다.`);
                }
            }
        } else {
            obj.channel.sendChat("[#] 입력하신 끝말잇기 방 번호를 가진 방이 존재하지 않습니다.");
        }
    }

    leaveRoom(obj) {
        let extraObj = obj.extraObj;
        if (!extraObj["wordRelay"] || !extraObj["wordRelay"][obj.channel.channelId]) this.initChannel(obj);
        let roomList = extraObj.wordRelay[obj.channel.channelId].roomList;

        if (this.isExistsUser(obj).isExists) {
            let room = this.isExistsRoom(obj).room;
            if (room.isStarted) {
                obj.channel.sendChat("[#] 끝말잇기 게임이 시작된 상태에서 퇴장할 수 없습니다.");
            } else {
                room.userList.forEach((user, index1) => {
                    if (user.userId.toString() === obj.chat.chat.sender.userId.toString()) {
                        room.userList.splice(index1, 1);
                        if (index1 === 0) {
                            if (room.userList.length === 0) {
                                roomList.splice(parseInt(room.number), 1);
                                obj.channel.sendChat("[#] 끝말잇기 방에서 퇴장하였습니다. 방에 아무도 없어서 방이 삭제되었습니다.");
                            } else {
                                obj.channel.sendChat("[#] 끝말잇기 방에서 퇴장하였습니다. 방장은 첫번째로 들어온 사람에게 이양되었습니다.");
                            }
                        } else {
                            obj.channel.sendChat("[#] 끝말잇기 방에서 퇴장하였습니다.");
                        }
                    }
                });
            }
        } else {
            obj.channel.sendChat("[#] 아무 방에도 참가되어 있지 않습니다.");
        }
    }

    startRoom(obj) {
        let extraObj = obj.extraObj;
        if (!extraObj["wordRelay"] || !extraObj["wordRelay"][obj.channel.channelId]) this.initChannel(obj);

        if (this.isMasterUser(obj).isMaster) {
            let room = this.isMasterUser(obj).room;
            if (room.userList.length < 1) {
                obj.channel.sendChat("[#] 끝말잇기 게임을 시작하기 위한 최소인원 (2명) 이 충족되지 않았습니다.");
            } else {
                if (room.isStarted) {
                    obj.channel.sendChat("[#] 이미 끝말잇기 게임이 시작되어 있습니다.");
                } else {
                    room.isStarted = true;

                    let wordList = ["자", "구", "성", "장", "강", "승"];
                    let word = wordList[Math.floor(Math.random() * wordList.length)];
                    room.words.push(word);

                    obj.channel.sendChat(`[#] 끝말잇기 게임이 시작했습니다! [ ${obj.chat.getSenderInfo(obj.channel).nickname} ] 님은 [ ${room.words[room.words.length - 1][room.words[room.words.length - 1].length - 1]} ] 로 시작하는 단어를 입력해주세요. 예) w자식`);
                }
            }
        } else {
            obj.channel.sendChat("[#] 당신은 방장이 아닙니다.");
        }
    }

    roseRoom(obj, user) {
        let extraObj = obj.extraObj;
        if (!extraObj["wordRelay"] || !extraObj["wordRelay"][obj.channel.channelId]) this.initChannel(obj);
        let roomList = extraObj.wordRelay[obj.channel.channelId].roomList;

        let room = this.isExistsUser(obj).room;
        let userInfo = obj.channel.getUserInfo(user);

        room.userList.forEach((user1, index) => {
            if (user1.userId.toString() === user.userId.toString()) {
                if (room.userList[room.turnCount].userId.toString() === user.userId.toString()) {
                    clearTimeout(room.timer);
                }
                room.userList.splice(index, 1);
            }
        });

        if (room.userList.length > 1) {
            let nextUser = room.userList[room.turnCount];
            room.timer = setTimeout(() => {
                tempCommand.roseRoom(obj, nextUser);
            }, 30000);
            obj.channel.sendChat(`[#] [ ${userInfo.nickname} ] 님이 패배하셨습니다. 다음 차례는 [ ${obj.channel.getUserInfo(room.userList[room.turnCount]).nickname} ] 님 차례입니다. 다음 차례는 [ ${room.words[room.words.length - 1][room.words[room.words.length - 1].length - 1]} ] 으로 시작하는 단어를 입력해주세요. \n\n사용된 단어 리스트: ${room.words.join(", ")}`);
        } else {
            roomList.splice(parseInt(room.number), 1);
            obj.channel.sendChat(`[#] [ ${userInfo.nickname} ] 님이 패배하셨습니다. 남은 사람이 한명 뿐이므로 [ ${obj.channel.getUserInfo(room.userList[0]).nickname} ] 님이 우승하셨습니다. (방은 자동 삭제처리됨.)`);
        }
    }

    runArg(obj) {
        let type = obj.chat.text.split(" ")[1];
        switch (type) {
            case "목록":
                this.replyRoomList(obj);
                break;

            case "생성":
                this.createRoom(obj);
                break;

            case "참가":
                this.joinRoom(obj);
                break;

            case "퇴장":
                this.leaveRoom(obj);
                break;

            case "시작":
                this.startRoom(obj);
                break;

            case "기권":
                this.roseRoom(obj, obj.chat.chat.sender);
                break;

            default:
                break;
        }
    }
}

class WordRelayGameCommand extends Handler {
    constructor() {
        super(false, "");
    }

    async isCanUseWord(word) {
        if (word.includes(" ")) return false;
        let res = await axios({ method: "GET", url: `https://stdict.korean.go.kr/m/search/searchResult.do?searchKeyword=${encodeURI(word)}` });
        try {
            if (parseInt(res.data.split("찾기 결과 (총 ")[1].split("개)")[0].trim()) > 0) return true;
            return false;
        } catch (e) {
            return false;
        }
    }

    async run(obj) {
        let tempCommand = new WordRelayCommand();
        if (tempCommand.isExistsUser(obj).isExists) {
            let room = tempCommand.isExistsUser(obj).room;

            if (room.isStarted && obj.chat.text.startsWith(`w${room.words[room.words.length - 1][room.words[room.words.length - 1].length - 1]}`) && tempCommand.isMyTurn(obj)) {
                let word = obj.chat.text.slice(1);
                if (room.words.includes(word)) {
                    obj.channel.sendChat("[#] 이미 사용된 단어입니다. 다른 단어를 입력해주세요.");
                } else {
                    let canUseWord = await this.isCanUseWord(word);
                    if (canUseWord) {
                        if (room.isFirst) {
                            room.words[0] = word;
                            room.isFirst = false;
                        } else room.words.push(word);
                        if (room.turnCount === room.userList.length - 1) room.turnCount = 0;
                        else room.turnCount++;

                        clearTimeout(room.timer);
                        let nextUser = room.userList[room.turnCount];
                        room.timer = setTimeout(() => {
                            tempCommand.roseRoom(obj, nextUser);
                        }, 30000);

                        obj.channel.sendChat(`[#] [ ${obj.chat.getSenderInfo(obj.channel).nickname} ] 님이 단어를 입력하셨습니다. 다음 차례는 [ ${obj.channel.getUserInfo(room.userList[room.turnCount]).nickname} ] 님 차례입니다. 다음 차례는 [ ${room.words[room.words.length - 1][room.words[room.words.length - 1].length - 1]} ] 으로 시작하는 단어를 입력해주세요. 만약 30초동안 입력하지 못할 시 자동 패배처리 됩니다.\n\n사용된 단어 리스트: ${room.words.join(", ")}`);
                    } else {
                        obj.channel.sendChat("[#] 국어사전에 등록되지 않은 단어입니다.");
                    }
                }
            }
        }
    }
}

module.exports = { WordRelayCommand, WordRelayGameCommand };