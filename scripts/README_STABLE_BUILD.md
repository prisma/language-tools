<h2 align="center">Prisma VS Code Extension</h2>
<div align="center">
  Adds syntax highlighting, linting, code completion, formatting, jump-to-definition and more for <a href="https://www.prisma.io/docs/concepts/components/prisma-schema">Prisma Schema</a> files.
</div>

## Features

- Syntax highlighting of `schema.prisma`
- Linting
  - Diagnostic tools are used to surface errors and warnings in your schema file as you type.
- Code Completion
  - Completion results appear for symbols as you type.
  - You can trigger this manually with the `Ctrl+Space` shortcut.
- Documentation help
  - Documentation of a completion result pops up as completion results are provided.
- Quick info on hover
  - Documentation Comments (`///`) of models and enums appear anywhere you hover over their usages.
- Go to Definition
  - Jump to or peek a model or enum's declaration.
- Formatting
  - Format code either manually or on save (if configured).
    - _To automatically format on save, add the following to your `settings.json` file:_
      ```
      "editor.formatOnSave": true
      ```
    - _To enable formatting in combination with `prettier`, add the following to your `settings.json` file:_
      ```
      "[prisma]": {
        "editor.defaultFormatter": "Prisma.prisma"
      },
      ```
      or use the [Prettier plugin for Prisma](https://github.com/umidbekk/prettier-plugin-prisma)
- Rename
  - Rename models, enums, fields and enum values
    - Click into the model or enum, press `F2` and then type the new desired name and press `Enter`
    - All usages will be renamed
    - Automatically applies `@map` or `@@map` on the schema
- Quick-fixes
  - Quickly fix typos in model and enum names
  - Create new models and enums with a single click

## Preview

<details>
  <summary>Syntax-Highlighting</summary>

![Preview Schema](https://i.imgur.com/W80iRwE.png)

</details>
<details>
  <summary>Quick-Fixes</summary>
  
![Quick Fixes](https://github.com/prisma/language-tools/blob/main/packages/vscode/resources/spellingFix.gif?raw=true)
</details>

## Contributing

Read more about [how to contribute to the Prisma VSCode extension](./packages/vscode/CONTRIBUTING.md)

## Telemetry

This extension collects telemetry data to help us better the usage of the extension. You can read more about that [in Prisma's documentation ](https://www.prisma.io/docs/reference/more/telemetry). The extension respects the `telemetry.enableTelemetry` setting in VSCode. If you want to opt out of telemetry, set `"telemetry.enableTelemetry": false` in your VSCode settings.

## Build information

This is for Prisma CLI $prisma-cli-version$.

## Security

If you have a security issue to report, please contact us at [security@prisma.io](mailto:security@prisma.io?subject=[GitHub]%20Prisma%202%20Security%20Report%20VSCode)
