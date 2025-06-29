# Playwright Tests for Prisma VS Code Extension

This directory contains Playwright tests that run VS Code with the Prisma extension in Electron to test UI functionality.

## Setup

The tests are configured to:
- Launch VS Code in development mode with the Prisma extension loaded
- Test basic extension functionality through the UI
- Focus on command execution rather than detailed business logic

## Test Structure

### `extension.spec.ts`
Contains the main test suite with three tests:

1. **Extension Launch Test**: Verifies that VS Code loads successfully with the Prisma extension
2. **Prisma Studio Command Test**: Tests that the "Prisma: Launch Prisma Studio" command is available and can be executed
3. **Schema File Loading Test**: Verifies that Prisma schema files are loaded and recognized correctly in the workspace

### Utilities (`utils/`)

#### `vscode-setup.ts`
- `setupVSCode()`: Handles VS Code download, configuration, and launch with customizable options
- Provides consistent launch arguments and error handling

#### `page-helper.ts`
- `VSCodePageHelper`: Class with methods for common VS Code UI interactions
  - `create()`: Static factory method that gets the first window, waits for workbench, and creates a ready-to-use helper instance
  - `waitForWorkbench()`: Waits for VS Code to fully load (called automatically by `create()`)
  - `openCommandPalette()`: Opens the command palette
  - `executeCommand()`: Types and executes a command
  - `openFile()`: Opens a file from the explorer
  - `getCleanEditorContent()`: Gets editor content with line numbers removed

#### `constants.ts`
- `TIMEOUTS`: Centralized timeout configurations with default values for PageHelper
- `SELECTORS`: CSS selectors for common VS Code elements
- `COMMANDS`: Predefined command names
- `KEYBOARD_SHORTCUTS`: Common keyboard shortcuts  
- `WAIT_TIMES`: Standardized wait durations for UI operations

## Test Workspace

The tests use a fixture workspace located at `tests/fixtures/test-workspace/` containing:
- `schema.prisma`: A sample Prisma schema with User and Post models
- `package.json`: Basic package configuration

This workspace is automatically loaded when VS Code starts, providing context for testing extension functionality with actual Prisma files.

## Running Tests

```bash
# Run all Playwright tests (shows VS Code window)
npm run test:playwright

# Run tests in headless mode (Linux/macOS with xvfb)
npm run test:playwright:headless

# Run a specific test file
npx playwright test extension.spec.ts

# Run tests with UI (for debugging)
npx playwright test --ui

# Run a specific test
npx playwright test --grep "Prisma Studio command"

# Simulate CI environment locally
CI=true npm run test:playwright
```

## Performance Optimizations

The test suite has been optimized for faster execution and maintainability:
- **Centralized constants**: All selectors, timeouts, and commands moved to `constants.ts`
- **Reduced timeouts**: Optimized timing values for faster test execution
- **Shared utilities**: Eliminated redundant code patterns with helper classes
- **Efficient selectors**: Use specific CSS selectors for faster element detection
- **Minimal waiting**: Only wait as long as necessary for each operation
- **Clean logging**: Removed excessive console output, keeping only essential error information

## Headless Mode

**Note**: VS Code is an Electron application and will always show a window when running on a machine with a display. 

- **In CI**: Tests run "headlessly" using `xvfb` (virtual framebuffer) which provides a virtual display
- **Locally**: By default, VS Code windows will be visible. Use `npm run test:playwright:headless` on Linux/macOS to simulate CI behavior
- **CI Detection**: The test setup automatically applies CI-optimized flags when `process.env.CI` is true

## Test Configuration

The tests use the following VS Code launch arguments for reliable testing:
- `--extensionDevelopmentPath`: Loads the extension in development mode
- `--disable-extensions`: Disables other extensions to avoid conflicts
- `--disable-workspace-trust`: Skips workspace trust prompts
- `--skip-welcome` / `--skip-release-notes`: Skips intro screens
- `--no-sandbox`, `--disable-dev-shm-usage`, `--disable-gpu`: Stability flags for headless environments
- `--user-data-dir`: Uses a temporary user data directory
- `--wait`: Prevents VS Code from exiting immediately

## Key Implementation Details

### Window Detection
The tests wait for VS Code windows to appear and use `electronApp.firstWindow()` to get the main window.

### Workbench Loading
Tests wait for the `.monaco-workbench` selector to ensure VS Code has fully loaded before proceeding.

### Command Palette Testing
The command execution utility:
1. Opens the command palette with `Meta+Shift+P` (Cmd+Shift+P on macOS)
2. Types the command name
3. Verifies the command appears in the dropdown
4. Executes the command by pressing Enter
5. Provides error handling if commands are not found

## Debugging

If tests fail:
1. Check the console output for error messages
2. Screenshots are automatically taken on failures and saved to the project root
3. Use `--ui` flag to run tests interactively
4. Check that the extension builds successfully with `npm run build`
5. Verify workspace fixtures exist and contain expected content

## Future Enhancements

This test setup can be extended to test:
- More Prisma commands (format, generate, etc.)
- File operations and syntax highlighting
- Extension settings and configuration
- Integration with Prisma schema files
- Language server features (autocomplete, validation, etc.)
