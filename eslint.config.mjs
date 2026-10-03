import js from '@eslint/js';
import globals from 'globals';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'; // <-- Добавили

export default [
    js.configs.recommended,
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaFeatures: { jsx: true },
                ecmaVersion: 'latest',
                sourceType: 'module',
            },
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
            'react': reactPlugin,
            'react-hooks': reactHooksPlugin,
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,

            'no-undef': 'off',
            'no-redeclare': 'off',
            '@typescript-eslint/no-redeclare': 'off',

            'react/react-in-jsx-scope': 'off',
            'react/prop-types': 'off',

            '@typescript-eslint/no-explicit-any': 'warn',
        },
        settings: {
            react: { version: 'detect' },
        },
    },
    eslintPluginPrettierRecommended,
    {
        ignores: ['dist/**', 'node_modules/**', '*.config.js', '*.config.ts', '*.config.mjs'],
    },
];