// Expo's recommended rules, including react-hooks (rules-of-hooks, exhaustive-deps).
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([expoConfig, { ignores: ['dist/*', 'node_modules/*', '.expo/*'] }]);
