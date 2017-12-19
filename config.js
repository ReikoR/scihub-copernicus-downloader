let config = require('./config-base');

try {
    config = require('./config_');
} catch (e) {
    if (e instanceof Error && e.code === 'MODULE_NOT_FOUND') {
        console.warn('No custom config found. Create config_.js to change default config in config-base.js');
    } else {
        throw e;
    }
}

module.exports = config;