import {
  CompletionItem,
  CompletionItemKind,
  MarkupKind,
} from 'vscode-languageserver'

export const corePrimitiveTypes: CompletionItem[] = [
  {
    label: 'String',
    kind: CompletionItemKind.TypeParameter,
    documentation: 'Variable length text',
  },
  {
    label: 'Boolean',
    kind: CompletionItemKind.TypeParameter,
    documentation: 'True or false value',
  },
  {
    label: 'Int',
    kind: CompletionItemKind.TypeParameter,
    documentation: 'Integer value',
  },
  {
    label: 'Float',
    kind: CompletionItemKind.TypeParameter,
    documentation: 'Floating point number',
  },
  {
    label: 'DateTime',
    kind: CompletionItemKind.TypeParameter,
    documentation: 'Timestamp',
  },
]

export const allowedBlockTypes: CompletionItem[] = [
  {
    label: 'datasource',
    kind: CompletionItemKind.Class,
    documentation:
      'The datasource block tells the schema where the models are backed.',
  },
  {
    label: 'generator',
    kind: CompletionItemKind.Class,
    documentation:
      "Generator blocks configure which clients are generated and how they're generated. Language preferences and binary configuration will go in here.",
  },
  {
    label: 'model',
    kind: CompletionItemKind.Class,
    documentation:
      'Models represent the entities of your application domain. They are defined using model blocks in the data model.',
  },
  {
    label: 'type_alias',
    kind: CompletionItemKind.Class,
  },
  {
    label: 'enum',
    kind: CompletionItemKind.Class,
    documentation:
      "Enums are defined via the enum block. You can define enums in your data model if they're supported by the data source you use:\n• PostgreSQL: Supported\n• MySQL: Supported\n• MariaDB: Supported\n• SQLite: Not supported",
  },
]

export const blockAttributes: CompletionItem[] = [
  {
    label: '@@map([])',
    kind: CompletionItemKind.Property,
    insertTextFormat: 2,
    insertText: '@@map([$0])',
    documentation: {
      kind: MarkupKind.Markdown,
      value: [
        '```prisma',
        '@@map(_ name: String)',
        '```',
        '___',
        'Maps a model name from the Prisma schema to a different table name.',
        '',
        '_@param_ `name` The name of the target database table',
      ].join('\n'),
    },
  },
  {
    label: '@@id([])',
    kind: CompletionItemKind.Property,
    insertTextFormat: 2,
    insertText: '@@id([$0])',
    documentation: {
      kind: MarkupKind.Markdown,
      value: [
        '```prisma',
        '@@id(_ fields: FieldReference[])',
        '```',
        '___',
        'Defines a multi-field ID on the model.',
        '',
        '_@param_ `fields` A list of references',
      ].join('\n'),
    },
  },
  {
    label: '@@unique([])',
    kind: CompletionItemKind.Property,
    insertTextFormat: 2,
    insertText: '@@unique([$0])',
    documentation: {
      kind: MarkupKind.Markdown,
      value: [
        '```prisma',
        '@@unique(_ fields: FieldReference[])',
        '```',
        '___',
        'Defines a compound unique constraint for the specified fields.',
        '',
        '_@param_ `fields` A list of references',
      ].join('\n'),
    },
  },
  {
    label: '@@index([])',
    kind: CompletionItemKind.Property,
    insertTextFormat: 2,
    insertText: '@@index([$0])',
    documentation: {
      kind: MarkupKind.Markdown,
      value: [
        '```prisma',
        '@@index(_ fields: FieldReference[])',
        '```',
        '___',
        'Defines an index.',
        '',
        '_@param_ `fields` A list of references',
      ].join('\n'),
    },
  },
]

export const fieldAttributes: CompletionItem[] = [
  {
    label: '@id',
    kind: CompletionItemKind.Property,
    documentation: {
      kind: MarkupKind.Markdown,
      value: [
        '```prisma',
        '@id',
        '```',
        '___',
        'Defines a single-field ID on the model.',
      ].join('\n'),
    },
  },
  {
    label: '@unique',
    kind: CompletionItemKind.Property,
    documentation: {
      kind: MarkupKind.Markdown,
      value: [
        '```prisma',
        '@unique',
        '```',
        '___',
        'Defines a unique constraint for this field.',
      ].join('\n'),
    },
  },
  {
    label: '@map()',
    kind: CompletionItemKind.Property,
    insertTextFormat: 2,
    insertText: '@map($0)',
    documentation: {
      kind: MarkupKind.Markdown,
      value: [
        '```prisma',
        '@map(_ name: String)',
        '```',
        '___',
        'Maps a field name from the Prisma schema to a different column name.',
        '',
        '_@param_ `name` The name of the target database column',
      ].join('\n'),
    },
  },
  {
    label: '@default()',
    kind: CompletionItemKind.Property,
    insertTextFormat: 2,
    insertText: '@default(0)',
    documentation: {
      kind: MarkupKind.Markdown,
      value: [
        '```prisma',
        '@default(_ expression: Expression)',
        '```',
        '___',
        'Defines a default value for this field. `@default` takes an expression as an argument.',
        '',
        '_@param_ `expression` An expression (e.g. `5`, `true`, `now()`)',
      ].join('\n'),
    },
  },
  {
    label: '@relation()',
    kind: CompletionItemKind.Property,
    insertTextFormat: 2,
    insertText: '@relation($0)',
    documentation: {
      kind: MarkupKind.Markdown,
      value: [
        '```prisma',
        '@relation(_ name: String?, fields: FieldReference[]?, references: FieldReference[]?)',
        '```',
        '___',
        'Defines meta information about the relation. [Learn more](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-schema/relations#the-relation-attribute).',
        '',
        '_@param_ `name` A name of field references',
        '',
        '_@param_ `fields` A list of field references',
        '',
        '_@param_ `references` A list of field references',
      ].join('\n'),
    },
  },
  {
    label: '@updatedAt',
    kind: CompletionItemKind.Property,
    documentation:
      'Automatically stores the time when a record was last updated.',
  },
]

export const supportedDataSourceFields: CompletionItem[] = [
  {
    label: 'provider',
    kind: CompletionItemKind.Field,
    documentation: {
      kind: MarkupKind.Markdown,
      value: 'Describes which data source connector to use.',
    },
  },
  {
    label: 'url',
    kind: CompletionItemKind.Field,
    documentation: {
      kind: MarkupKind.Markdown,
      value:
        'Connection URL including authentication info. Each datasource provider documents the URL syntax. Most providers use the syntax provided by the database, [learn more](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-schema).',
    },
  },
]

export const supportedGeneratorFields: CompletionItem[] = [
  {
    label: 'provider',
    kind: CompletionItemKind.Field,
    documentation: {
      kind: MarkupKind.Markdown,
      value:
        'Describes which generator to use. This can point to a file that implements a generator or specify a built-in generator directly.',
    },
  },
  {
    label: 'output',
    kind: CompletionItemKind.Field,
    documentation: {
      kind: MarkupKind.Markdown,
      value:
        'Determines the location for the generated client, [learn more](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-schema)',
    },
  },
  {
    label: 'binaryTargets',
    kind: CompletionItemKind.Field,
    documentation: {
      kind: MarkupKind.Markdown,
      value: [
        'Specifies the OS on which the Prisma Client will run to ensure binary compatibility of the query engine.',
      ].join('\n'),
    },
  },
]
