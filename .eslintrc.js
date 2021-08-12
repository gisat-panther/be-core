module.exports = {
    env: {
        commonjs: true,
        es2021: true,
        node: true,
    },
    extends: 'eslint:recommended',
    parserOptions: {
        ecmaVersion: 12,
    },
    rules: {
        'no-prototype-builtins': 0,
        'no-unused-vars': [
            'error',
            {vars: 'all', args: 'none', ignoreRestSiblings: false},
        ],
    },
};
