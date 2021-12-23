<h2 align="center">Prisma VS Code Extension - Insider</h2>

## Insider Build

This is the Insider Build of the [Prisma VSCode extension](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma). Most users should not use this version, but instead install
the regular version of the extension.This version of the extension may contain unstable prerelease code and is directly built from the main branch.

**Only use this extension if you are also using the dev version of the CLI.**

Please note that you should not have the regular and insider version of the extension installed at the same time.

## Preview

<details>
  <summary>Syntax-Highlighting</summary>

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

## Build information

- This version is built from commit [$commit-sha$](https://github.com/prisma/language-tools/commit/$commit-sha$).
- This is for Prisma CLI $prisma-cli-version$.

## Contributing

Read more about [how to contribute to the Prisma VSCode extension](./packages/vscode/CONTRIBUTING.md)

## Telemetry

This extension collects telemetry data to help us better the usage of the extension. You can read more about that [here](https://www.prisma.io/docs/reference/more/telemetry).\
The extension respects the `telemetry.enableTelemetry` setting in VSCode. If you want to opt out of telemetry, set `"telemetry.enableTelemetry": false` in your VSCode settings.

## Security

If you have a security issue to report, please contact us at [security@prisma.io](mailto:security@prisma.io?subject=[GitHub]%20Prisma%202%20Security%20Report%20VSCode)
