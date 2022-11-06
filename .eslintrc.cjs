/* eslint-disable quotes, quote-props */
const isWindows = (process.platform === 'win32');
const linebreakStyle = isWindows ? 'windows' : 'unix';

module.exports = {
	"env": {
		"browser": true,
		"jest/globals": true,
		// "es6": true
	},
	"extends": "airbnb-base",
	"plugins": ["jest"],
	"globals": {
		// "Atomics": "readonly",
		// "SharedArrayBuffer": "readonly"
	},
	"ignorePatterns": [
		"scripts/libs/*",
	],
	"parserOptions": {
		"ecmaVersion": 2018,
		"sourceType": "module",
	},
	"rules": {
		"indent": ["error", "tab"],
		"no-tabs": ["warn", { allowIndentationTabs: true }],
		"linebreak-style": ["error", linebreakStyle],
		"import/extensions": ["warn", "always"],
		"no-console": ["warn", { allow: ["warn", "error"] }],
		"max-lines": ["error", { "max": 1500, "skipComments": true }],
	},
};
