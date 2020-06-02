import { CompletionItem, CompletionItemKind } from 'vscode-languageserver'

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
    detail: '@@map(_ name: String)',
    insertTextFormat: 2,
    insertText: '@@map([$0])',
    documentation:
      'Defines the name of the underlying table or collection name.',
  },
  {
    label: '@@id([])',
    kind: CompletionItemKind.Property,
    detail: '@@id(_ fields: Identifier[])',
    insertTextFormat: 2,
    insertText: '@@id([$0])',
    documentation: 'Defines a composite primary key across fields.',
  },
  {
    label: '@@unique([])',
    kind: CompletionItemKind.Property,
    detail: '@@unique(_ fields: Identifier[], name: String?)',
    insertTextFormat: 2,
    insertText: '@@unique([$0])',
    documentation: 'Defines a composite unique constraint across fields.',
  },
  {
    label: '@@index([])',
    kind: CompletionItemKind.Property,
    insertTextFormat: 2,
    insertText: '@@index([$0])',
    detail: '@@index(_ fields: Identifier[], name: String?)',
    documentation: 'Defines an index for multiple fields.',
  },
]

export const fieldAttributes: CompletionItem[] = [
  {
    label: '@id',
    kind: CompletionItemKind.Property,
    detail: '@id',
    documentation:
      'Defines the primary key. There must be exactly one field @id or block @id',
  },
  {
    label: '@unique',
    kind: CompletionItemKind.Property,
    detail: '@unique',
    documentation: 'Defines the unique constraint.',
  },
  {
    label: '@map()',
    kind: CompletionItemKind.Property,
    detail: '@map(_ name: String)',
    insertTextFormat: 2,
    insertText: '@map($0)',
    documentation: 'Defines the raw column name the field is mapped to.',
  },
  {
    label: '@default()',
    kind: CompletionItemKind.Property,
    detail: '@default(_ expr: Expr)',
    insertTextFormat: 2,
    insertText: '@default(0)',
    documentation: 'Specifies a default value if null is provided.',
  },
  {
    label: '@relation()',
    kind: CompletionItemKind.Property,
    insertTextFormat: 2,
    insertText: '@relation($0)',
    detail:
      '@relation(_ name?: String, references?: Identifier[], onDelete?: CascadeEnum)\nArguments:\n•name: (optional, except when required for disambiguation) defines the name of the relationship. The name of the relation needs to be explicitly given to resolve amibiguities when the model contains two or more fields that refer to the same model (another model or itself).\n•references: (optional) list of field names to reference',
    documentation:
      'Specifies and disambiguates relationships when needed. Where possible on relational databases, the @relation annotation will translate to a foreign key constraint, but not an index.',
  },
]

export const supportedDataSourceFields: CompletionItem[] = [
  {
    label: 'provider',
    kind: CompletionItemKind.Field,
    documentation:
      'Can be one of the following built in datasource providers:\n•`postgresql`\n•`mysql`\n•`sqlite`',
  },
  {
    label: 'url',
    kind: CompletionItemKind.Field,
    documentation:
      'Connection URL including authentication info. Each datasource provider documents the URL syntax. Most providers use the syntax provided by the database. (more information see https://github.com/prisma/specs/blob/master/schema/datasource_urls.md)',
  },
]

export const supportedGeneratorFields: CompletionItem[] = [
  {
    label: 'provider',
    kind: CompletionItemKind.Field,
    documentation:
      'Can be a path or one of the following built in datasource providers:\n•`prisma-client-js`\n•`prisma-client-go` (This is not implemented yet.)',
  },
  {
    label: 'output',
    kind: CompletionItemKind.Field,
    documentation: 'Path for the generated client.',
  },
]
