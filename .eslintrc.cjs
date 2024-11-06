module.exports = {
    "env": {
        "browser": true,
        "node": true,
        "es2021": true,
        "mocha": true  // Add Mocha environment
    },
    "extends": [
        "airbnb-base"
    ],
    "parserOptions": {
        "ecmaVersion": 12,
        "sourceType": "module"
    },
    "rules": {
        "no-console": "off",
        "comma-dangle": ["error", "never"],
        "max-len": ["warn", { "code": 120 }],
        "object-curly-newline": "off",
        "camelcase": "off"
    }
};
