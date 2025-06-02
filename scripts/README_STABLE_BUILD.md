<h2 align="center">Prisma VS Code Extension</h2>
<div align="center">
  Adds a database management UI, syntax highlighting, linting, code completion, formatting, jump-to-definition and more for <a href="https://www.prisma.io/docs/concepts/components/prisma-schema">Prisma Schema</a> files.
</div>

## Features

### Visual database management UI

The Prisma VS Code extension features a database managent UI that you can access via the **Prisma logo** in the sidebar. It allows to manage Prisma Postgres instances:

- Authenticate with the [Prisma Console](https://console.prisma.io)
- Create and delete Prisma Postgres instances (remote & local)
- View and edit data via an embedded Prisma Studio
- Visualize your database schema

### Editor support

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
  <summary>Database management UI</summary>

The database management UI gives you a visual way to perform various database workflows.
![Preview Schema](tbd)

</details>

<details>
  <summary>Syntax highlighting</summary>

Syntax highlighting eases visual comprehension of the Prisma schema.
![Preview Schema](https://user-images.githubusercontent.com/1328733/147264843-fc32c2aa-7490-4e49-9478-abc16cbd0682.png)

</details>
<details>
  <summary>Formatting</summary>

Formatting ensures consistent indentation of your models for better readability.
![Formatting](https://user-images.githubusercontent.com/1328733/147264852-849cb539-9bdc-4916-9d0f-483536061f7c.gif)

</details>
<details>
  <summary>Linting and autocompletion</summary>

Linting shows inline errors in the schema, and autocompletion assists in defining the correct type.
![Linting and autocompletion](https://user-images.githubusercontent.com/1328733/147265321-2e1956ec-9f57-4ff3-9493-8163a727308d.gif)

</details>
<details>
  <summary>Contextual suggestions</summary>

Contextual suggestions assist in defining field types, models, and relations while formatting automatically defines back relations.
![Contextual suggestions](https://user-images.githubusercontent.com/1328733/147265323-4eb397b4-acda-4c78-9f27-1230d7ea4603.gif)

</details>
<details>
  <summary>Jump-to-definition</summary>

Easily navigate definitions, i.e. models in the Prisma schema.

![Jump-to-definition](https://user-images.githubusercontent.com/1328733/147265315-838cd63c-e0c6-485c-aec9-1b1707291719.gif)

</details>

## Contributing

Read more about [how to contribute to the Prisma VS Code extension](./packages/vscode/CONTRIBUTING.md)

## Telemetry

This extension collects telemetry data to help us better the usage of the extension. You can read more about that [in Prisma's documentation](https://www.prisma.io/docs/reference/more/telemetry).
The extension respects:

- the `telemetry.enableTelemetry` setting in VS Code ([deprecated since v1.61](https://code.visualstudio.com/updates/v1_61#_telemetry-settings)).
- the `telemetry.telemetryLevel` setting in VS Code (see [docs](https://code.visualstudio.com/docs/getstarted/telemetry))

If you want to opt out of telemetry you can either, in your VS Code settings:

- set `"telemetry.enableTelemetry": false`
- set `"telemetry.telemetryLevel": "off"` (or "crash" or "error")

## Build information

This is for Prisma CLI $prisma-cli-version$.

## Security

If you have a security issue to report, please contact us at [security@prisma.io](mailto:security@prisma.io?subject=[GitHub]%20Prisma%202%20Security%20Report%20VSCode)
