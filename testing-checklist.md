# Test Checklist
Beforehand:
- disable prisma vscode plugin

Syntax highlighting
- open `testDb.prisma` from the folder
- all fields should now be syntax-highlighted 
- remove `datasource`
- first block should not be syntax-highlighted anymore

Auto-formatting
- open `testDb.prisma` from the folder
- add whitespaces between any two words or before any word
- press <kbd>shift</kbd> + <kbd>alt</kbd> + <kbd>f</kbd>
- whitespaces should be undone

Linting
- open `testDb.prisma` from the folder
- remove `provider` from datasource `db`
- `db` should now have red squiggles
- a warning should be shown that argument `provider` is missing
- replace `author User?` with `author Use` or any other word containing a spelling error
- red squiggles should underline the error and also a quick error description should be shown
- remove `?` from `authorId Int?`
- line `author` should be marked red, as at least one field of  `author` and `authorId` is required 
