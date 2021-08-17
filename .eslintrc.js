module.exports = {
    env: {
        commonjs: true,
        es2021: true,
        node: true,
    },
    globals: {
        describe: 'readonly',
        it: 'readonly',
        before: 'readonly',
        after: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
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
