class Handler {
    constructor(isCommand, command) {
        this.isCommand = isCommand;
        this.command = command;
    }

    run(obj) { }

    runArg(obj) { }
}

module.exports = { Handler };