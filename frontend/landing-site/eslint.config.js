import globals from 'globals'
import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'no-console': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
          disallowTypeAnnotations: false,
        },
      ],
      'no-duplicate-imports': 'error',
      // Enforce brand color usage (warn during dev, block on commit)
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'Literal[value=/#[0-9a-f]{3,8}/i]',
          message: 'Do not hardcode hex colors. Import from @fundrbolt/shared/assets instead.',
        },
        {
          selector: 'Literal[value=/rgb\\(/i]',
          message: 'Do not hardcode RGB colors. Import from @fundrbolt/shared/assets instead.',
        },
        {
          selector: 'Literal[value=/hsl\\(/i]',
          message: 'Do not hardcode HSL colors. Import from @fundrbolt/shared/assets instead.',
        },
      ],
    },
  },
  // Exemption for colors.ts - allow hardcoded colors in theme definition
  {
    files: ['**/themes/colors.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  }
)
