module.exports = {
    root: true,
    parser: require.resolve('@typescript-eslint/parser'),
    parserOptions: {
        tsconfigRootDir: __dirname,
        sourceType: 'module',
    },
    env: {
        node: true,
        es2021: true,
        jest: true,
    },
    extends: ['eslint:recommended'],
    ignorePatterns: ['dist', 'node_modules'],
    rules: {
        'no-async-promise-executor': 'off',
        'no-constant-condition': 'off',
        'no-empty': 'off',
        'no-undef': 'off',
        'no-unused-vars': 'off',
    },
};
