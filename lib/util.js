const fs = require('fs');
const path = require('path');

module.exports = {
	checkComposerExist,
	sleep,
};

/**
 * Check if Composer.json exists in dir
 *
 * @param {string} dir
 * @returns {boolean}
 */
async function checkComposerExist(dir) {
	const file = path.join(dir, 'composer.json');
	return fs.existsSync(file);
}

/**
 * Async delay
 *
 * @param {string} ms Amout of milliseconds to delat/sleep.
 */
async function sleep(ms) {
	return await new Promise((resolve) => setTimeout(resolve, ms));
}
