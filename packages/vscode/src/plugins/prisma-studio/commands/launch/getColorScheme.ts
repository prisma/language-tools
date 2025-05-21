import { ColorThemeKind, window } from 'vscode'

export function getColorScheme(): string {
  const currentThemeKind = window.activeColorTheme.kind
  let colorScheme = 'light'
  switch (currentThemeKind) {
    case ColorThemeKind.Dark:
      colorScheme = 'dark'
    case ColorThemeKind.Light:
      colorScheme = 'light'
    case ColorThemeKind.HighContrast:
      colorScheme = 'dark'
  }

  return colorScheme
}
