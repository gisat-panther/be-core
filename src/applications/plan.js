/**
 * Compiled plan available to the whole application
 */
let _plan;

/**
 * Initializes this module with final compiled plan.
 */
function init(plan) {
    if (_plan != null) {
        throw new Error('Plan is already initialized');
    }

    _plan = plan;
}

module.exports = {
    get: () => _plan,
    init,
};
