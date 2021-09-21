/**
 * Commands available to the whole application.
 */
let _commands;

/**
 * Initializes module with commands.
 */
function init(commands) {
    _commands = commands;
}

module.exports = {
    init,
    get: () => _commands,
};
