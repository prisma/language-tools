# Manual Test Checklist

## Existing features

Beforehand:

- disable prisma vscode plugin
- install `prisma-lsp-0.0.31.vsix`

Syntax highlighting

- open `testDb.prisma` from the `src/test` folder
- all fields should now be syntax-highlighted
- remove `datasource`
- first block should not be syntax-highlighted anymore

Linting

- open `testDb.prisma` from the `src/test` folder
- remove `provider` from datasource `db`
- `db` should now have red squiggles
- a warning should be shown that argument `provider` is missing
- replace `author User?` with `author Use` or any other word containing a spelling error
- red squiggles should underline the error and also a quick error description should be shown
- remove `?` from `authorId Int?`
- line `author` should be marked red, as at least one field of `author` and `authorId` is required

Auto-formatting

- open `testDb.prisma` from the `src/test` folder
- add whitespaces between any two words or before any word
- press <kbd>shift</kbd> + <kbd>alt</kbd> + <kbd>f</kbd>
- whitespaces should be undone

## Additional jump-to-definition feature

Beforehand:

- disable prisma vscode plugin
- install `prisma-lsp-jump-to-def-0.0.31.vsix`

Jump-to-definition

- open `testDb.prisma` from the `src/test` folder
- click on relation `User` in model `Post`
- focus should now move to the term `User` in model `User`
