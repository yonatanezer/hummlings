import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// Pure logic and tests must never touch UI / native libraries.
const uiImports = [
  'react', 'react-native', 'react-native-*', 'expo', 'expo-*', '@shopify/*', '@react-native*',
  '**/ui/**', '**/audio/native*', '../ui', '../ui/*',
];

export default tseslint.config(
  { ignores: ['.claude/**', 'src/content/loopAssets.ts', 'src/ui/iconAssets.ts', 'node_modules/**', 'dist/**', '.expo/**', 'android/**', 'ios/**', 'assets/**', 'scripts/out/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // Rule: src/core and tests have no UI imports (one renderer, pure logic).
    files: ['src/core/**/*.ts', 'tests/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: uiImports }] },
  },
);
