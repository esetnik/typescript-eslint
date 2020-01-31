import rule from '../../src/rules/prefer-readonly-parameter-types';
import { RuleTester, getFixturesRootDir } from '../RuleTester';
import { TSESLint } from '@typescript-eslint/experimental-utils';
import {
  InferMessageIdsTypeFromRule,
  InferOptionsTypeFromRule,
} from '../../src/util';

type MessageIds = InferMessageIdsTypeFromRule<typeof rule>;
type Options = InferOptionsTypeFromRule<typeof rule>;

const rootPath = getFixturesRootDir();

const ruleTester = new RuleTester({
  parser: '@typescript-eslint/parser',
  parserOptions: {
    tsconfigRootDir: rootPath,
    project: './tsconfig.json',
  },
});

const primitives = [
  'boolean',
  'true',
  'string',
  "'a'",
  'number',
  '1',
  'any',
  'unknown',
  'never',
  'null',
  'undefined',
];
const arrays = [
  'readonly string[]',
  'Readonly<string[]>',
  'ReadonlyArray<string>',
  'readonly [string]',
  'Readonly<[string]>',
];
const objects = [
  '{ foo: "" }',
  '{ foo: readonly string[] }',
  '{ foo(): void }',
];
const weirdIntersections = [
  `
    interface Test {
      (): void
      readonly property: boolean
    }
    function foo(arg: Test) {}
  `,
  `
    type Test = (() => void) & {
      readonly property: boolean
    };
    function foo(arg: Test) {}
  `,
];

ruleTester.run('prefer-readonly-parameter-types', rule, {
  valid: [
    'function foo(arg: { readonly a: string }) {}',
    'function foo() {}',

    // primitives
    ...primitives.map(type => `function foo(arg: ${type}) {}`),

    // arrays
    ...arrays.map(type => `function foo(arg: ${type}) {}`),
    // nested arrays
    'function foo(arg: readonly (readonly string[])[]) {}',
    'function foo(arg: Readonly<Readonly<string[]>[]>) {}',
    'function foo(arg: ReadonlyArray<ReadonlyArray<string>>) {}',

    // functions
    'function foo(arg: () => void) {}',

    // unions
    'function foo(arg: string | null) {}',
    'function foo(arg: string | ReadonlyArray<string>) {}',
    'function foo(arg: string | (() => void)) {}',
    'function foo(arg: ReadonlyArray<string> | ReadonlyArray<number>) {}',

    // objects
    ...objects.map(type => `function foo(arg: Readonly<${type}>) {}`),
    `
      function foo(arg: {
        readonly foo: {
          readonly bar: string
        }
      }) {}
    `,

    // weird other cases
    ...weirdIntersections.map(code => code),
    `
      interface Test extends ReadonlyArray<string> {
        readonly property: boolean
      }
      function foo(arg: Readonly<Test>) {}
    `,
    `
      type Test = (readonly string[]) & {
        readonly property: boolean
      };
      function foo(arg: Readonly<Test>) {}
    `,
    `
      type Test = string & number;
      function foo(arg: Test) {}
    `,

    // declaration merging
    `
      class Foo {
        readonly bang = 1;
      }
      interface Foo {
        readonly prop: string;
      }
      interface Foo {
        readonly prop2: string;
      }
      function foo(arg: Foo) {}
    `,
    // method made readonly via Readonly<T>
    `
      class Foo {
        method() {}
      }
      function foo(arg: Readonly<Foo>) {}
    `,
  ],
  invalid: [
    // arrays
    ...arrays.map<TSESLint.InvalidTestCase<MessageIds, Options>>(baseType => {
      const type = baseType
        .replace(/readonly /g, '')
        .replace(/Readonly<(.+?)>/g, '$1')
        .replace(/ReadonlyArray/g, 'Array');
      return {
        code: `function foo(arg: ${type}) {}`,
        errors: [
          {
            messageId: 'shouldBeReadonly',
            column: 14,
            endColumn: 19 + type.length,
          },
        ],
      };
    }),
    // nested arrays
    {
      code: 'function foo(arg: readonly (string[])[]) {}',
      errors: [
        {
          messageId: 'shouldBeReadonly',
          column: 14,
          endColumn: 40,
        },
      ],
    },
    {
      code: 'function foo(arg: Readonly<string[][]>) {}',
      errors: [
        {
          messageId: 'shouldBeReadonly',
          column: 14,
          endColumn: 39,
        },
      ],
    },
    {
      code: 'function foo(arg: ReadonlyArray<Array<string>>) {}',
      errors: [
        {
          messageId: 'shouldBeReadonly',
          column: 14,
          endColumn: 47,
        },
      ],
    },

    // objects
    ...objects.map<TSESLint.InvalidTestCase<MessageIds, Options>>(type => {
      return {
        code: `function foo(arg: ${type}) {}`,
        errors: [
          {
            messageId: 'shouldBeReadonly',
            column: 14,
            endColumn: 19 + type.length,
          },
        ],
      };
    }),
    {
      code: `
        function foo(arg: {
          readonly foo: {
            bar: string
          }
        }) {}
      `,
      errors: [
        {
          messageId: 'shouldBeReadonly',
          line: 2,
          column: 22,
          endLine: 6,
          endColumn: 10,
        },
      ],
    },

    // weird intersections
    ...weirdIntersections.map<TSESLint.InvalidTestCase<MessageIds, Options>>(
      baseCode => {
        const code = baseCode.replace(/readonly /g, '');
        return {
          code,
          errors: [{ messageId: 'shouldBeReadonly' }],
        };
      },
    ),
    {
      code: `
        interface Test extends Array<string> {
          readonly property: boolean
        }
        function foo(arg: Test) {}
      `,
      errors: [{ messageId: 'shouldBeReadonly' }],
    },
    {
      code: `
        interface Test extends Array<string> {
          property: boolean
        }
        function foo(arg: Test) {}
      `,
      errors: [{ messageId: 'shouldBeReadonly' }],
    },
  ],
});