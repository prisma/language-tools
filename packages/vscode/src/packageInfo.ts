/**
 * Package information injected at build time by esbuild.
 * See esbuild.mjs for the define configuration.
 *
 * This avoids runtime require() calls that don't work well with bundling.
 */

// Declare the global that esbuild injects
declare const __PACKAGE_JSON__: {
  name: string
  version: string
}

export const packageInfo = __PACKAGE_JSON__
