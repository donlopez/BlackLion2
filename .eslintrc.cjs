module.exports = {
    "env": {
        "browser": true,
        "node": true,  // Include Node environment
        "es2021": true
    },
    "extends": [
        "airbnb-base"
    ],
    "parserOptions": {
        "ecmaVersion": 12,
        "sourceType": "module"
    },
    "rules": {
        "no-console": "off"  // Disable no-console rule
        // You can add more rule customizations here if needed
    }
};

