# Features

This document describes the features supported by this extension. Most features are provided by the [@prisma/language-server](https://www.npmjs.com/package/@prisma/language-server).

## Table of Contents

* [IntelliSense](#intellisense)
  * [Code completion](#code-completion)
  * [Signature help](#signature-help)
  * [Quick info on hover](#quick-info-on-hover)
* [Code Navigation](#code-navigation)
  * [Go to definition](#go-to-definition)
* [Code Editing](#code-editing)
  * [Format](#format)
* [Diagnostics](#diagnostics)
  * [Linting](#linting)

## [IntelliSense](https://code.visualstudio.com/docs/editor/intellisense)

### Code Completion 
Completion results appear for symbols as you type. You can trigger this manually with the Ctrl+Space shortcut.

### Documentation help

Information about the documentation of a completion result pops up as completion results are provided.

### Quick info on Hover

Documentation Comments (`///`) of models and enums appear anywhere you hover over their usages.

## Code Navigation

### Go to Definition

Jump to or peek a model or enum's declaration.

## Code Editing

### Format

Format code either manually or on save (if configured). 

**To automatically format on save, add the following to your `settings.json` file:*
```
"editor.formatOnSave": true
```

## Diagnostics

### Linting

Diagnostic tools are used to surface errors and warnings in your schema file as you type.