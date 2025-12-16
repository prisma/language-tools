import * as esbuild from 'esbuild'
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire, builtinModules } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const production = process.argv.includes('--production')
const watch = process.argv.includes('--watch')

// Workaround for pnpm's symlinked node_modules structure
// Resolve the actual paths that esbuild should search
const nodeModulesPaths = [join(__dirname, 'node_modules'), join(__dirname, '..', '..', 'node_modules')]

const nodeBuiltins = new Set(builtinModules)

/**
 * Check if a module specifier is a Node.js built-in
 * @param {string} id
 */
function isNodeBuiltin(id) {
  if (id.startsWith('node:')) return true
  // Handle bare builtins and subpaths like 'fs/promises'
  const baseName = id.split('/')[0]
  return nodeBuiltins.has(baseName)
}

/**
 * Plugin to help esbuild resolve modules in pnpm's structure
 * @type {import('esbuild').Plugin}
 */
const pnpmResolvePlugin = {
  name: 'pnpm-resolve',
  setup(build) {
    // Intercept bare module imports that esbuild can't resolve
    build.onResolve({ filter: /^[^./]/ }, async (args) => {
      if (args.kind === 'entry-point') return null
      if (isNodeBuiltin(args.path)) return null

      try {
        // Try to resolve using Node's resolution algorithm
        const resolved = require.resolve(args.path, { paths: [args.resolveDir, ...nodeModulesPaths] })
        return { path: resolved }
      } catch {
        // Let esbuild try its own resolution
        return null
      }
    })
  },
}

/** @type {import('esbuild').Plugin} */
const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',
  setup(build) {
    build.onStart(() => {
      console.log('[watch] build started')
    })
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`)
        if (location) {
          console.error(`    ${location.file}:${location.line}:${location.column}:`)
        }
      })
      console.log('[watch] build finished')
    })
  },
}

/** @type {import('esbuild').BuildOptions} */
const extensionConfig = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  outfile: 'dist/extension.js',
  external: ['vscode', '@prisma/dev/internal/daemon'],
  minify: production,
  sourcemap: !production,
  plugins: [pnpmResolvePlugin, ...(watch ? [esbuildProblemMatcherPlugin] : [])],
  metafile: true,
  logLevel: 'info',
  // Help esbuild find modules in pnpm's symlinked structure
  nodePaths: nodeModulesPaths,
}

/** @type {import('esbuild').BuildOptions} */
const languageServerConfig = {
  entryPoints: ['../language-server/src/bin.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  outfile: 'dist/language-server/bin.js',
  external: [],
  minify: production,
  sourcemap: !production,
  plugins: [pnpmResolvePlugin, ...(watch ? [esbuildProblemMatcherPlugin] : [])],
  metafile: true,
  logLevel: 'info',
  // Help esbuild find modules in pnpm's symlinked structure
  nodePaths: [join(__dirname, '..', 'language-server', 'node_modules'), ...nodeModulesPaths],
}

async function build() {
  try {
    const distDir = join(__dirname, 'dist')
    if (existsSync(distDir)) {
      console.log('Cleaning dist directory...')
      // Remove old tsc output but keep the directory
      const oldTscDirs = ['src', 'tests']
      for (const dir of oldTscDirs) {
        const dirPath = join(distDir, dir)
        if (existsSync(dirPath)) {
          rmSync(dirPath, { recursive: true })
        }
      }
      // Remove old playwright config files
      for (const file of [
        'playwright.config.js',
        'playwright.config.js.map',
        'playwright.config.d.ts',
        'tsconfig.tsbuildinfo',
      ]) {
        const filePath = join(distDir, file)
        if (existsSync(filePath)) {
          rmSync(filePath)
        }
      }
    }

    // Build the main extension
    console.log('Building extension...')
    const extensionResult = await esbuild.build(extensionConfig)

    if (extensionResult.metafile) {
      const text = await esbuild.analyzeMetafile(extensionResult.metafile)
      console.log('Extension bundle analysis:')
      console.log(text)
    }

    // Build the language server
    console.log('\nBuilding language server...')
    const lsResult = await esbuild.build(languageServerConfig)

    if (lsResult.metafile) {
      const text = await esbuild.analyzeMetafile(lsResult.metafile)
      console.log('Language server bundle analysis:')
      console.log(text)
    }

    // Copy static assets that can't be bundled
    copyStaticAssets()

    console.log('\nBuild complete!')
  } catch (error) {
    console.error('Build failed:', error)
    process.exit(1)
  }
}

async function watchMode() {
  // Start watch mode for all builds
  const extensionContext = await esbuild.context(extensionConfig)
  const lsContext = await esbuild.context(languageServerConfig)

  await Promise.all([extensionContext.watch(), lsContext.watch()])

  // Copy static assets once at start
  copyStaticAssets()

  console.log('Watching for changes...')
}

function copyStaticAssets() {
  const nodeModulesDest = join(__dirname, 'dist/node_modules')
  mkdirSync(nodeModulesDest, { recursive: true })

  // Copy studio-core-licensed static files (UI assets served at runtime)
  const studioSrc = join(__dirname, 'node_modules/@prisma/studio-core-licensed')
  const studioDest = join(nodeModulesDest, '@prisma/studio-core-licensed')

  if (existsSync(studioSrc)) {
    console.log('Copying @prisma/studio-core-licensed static assets...')
    // Use dereference to resolve symlinks (important for pnpm)
    cpSync(studioSrc, studioDest, { recursive: true, dereference: true })
  }

  // Copy prisma-6-language-server (used when pinToPrisma6 is enabled)
  const prisma6LsSrc = join(__dirname, 'node_modules/prisma-6-language-server')
  const prisma6LsDest = join(nodeModulesDest, 'prisma-6-language-server')

  if (existsSync(prisma6LsSrc)) {
    console.log('Copying prisma-6-language-server...')
    // Use dereference to resolve symlinks (important for pnpm)
    cpSync(prisma6LsSrc, prisma6LsDest, { recursive: true, dereference: true })
  }

  // Copy prisma-schema-wasm WASM file to language server directory
  // The WASM is loaded via __dirname in the bundled code, so it needs to be
  // in the same directory as the bundled language server bin.js
  const lsDistDir = join(__dirname, 'dist/language-server')
  mkdirSync(lsDistDir, { recursive: true })

  try {
    // Find the prisma-schema-wasm package - resolve from language-server's context
    const lsNodeModules = join(__dirname, '..', 'language-server', 'node_modules')
    const wasmPackagePath = dirname(
      require.resolve('@prisma/prisma-schema-wasm/package.json', {
        paths: [lsNodeModules, ...nodeModulesPaths],
      }),
    )
    const wasmSrc = join(wasmPackagePath, 'src/prisma_schema_build_bg.wasm')

    if (existsSync(wasmSrc)) {
      console.log('Copying prisma-schema-wasm WASM file...')
      cpSync(wasmSrc, join(lsDistDir, 'prisma_schema_build_bg.wasm'))
    } else {
      console.warn('Warning: prisma_schema_build_bg.wasm not found at', wasmSrc)
    }
  } catch (err) {
    console.warn('Warning: Could not find @prisma/prisma-schema-wasm package:', err.message)
  }

  // Copy pglite assets for the PPG Dev Server worker
  // PGlite requires these files at runtime and loads them via __dirname
  const workersDistDir = join(__dirname, 'dist/workers')
  mkdirSync(workersDistDir, { recursive: true })

  try {
    // @electric-sql/pglite is a transitive dependency through @prisma/dev
    // pnpm's strict node_modules structure means we need to find it in the .pnpm store
    const pnpmStore = join(__dirname, '../../node_modules/.pnpm')
    const pglitePkgDir = readdirSync(pnpmStore).find(
      (dir) => dir.startsWith('@electric-sql+pglite@') && !dir.includes('socket') && !dir.includes('tools'),
    )

    if (pglitePkgDir) {
      const pgliteDistDir = join(pnpmStore, pglitePkgDir, 'node_modules/@electric-sql/pglite/dist')

      const pgliteAssets = ['pglite.data', 'pglite.wasm']
      for (const asset of pgliteAssets) {
        const assetSrc = join(pgliteDistDir, asset)
        if (existsSync(assetSrc)) {
          console.log(`Copying pglite ${asset}...`)
          cpSync(assetSrc, join(workersDistDir, asset))
        } else {
          console.warn(`Warning: ${asset} not found at`, assetSrc)
        }
      }
    } else {
      console.warn('Warning: Could not find @electric-sql/pglite package in pnpm store')
    }
  } catch (err) {
    console.warn('Warning: Could not find @electric-sql/pglite package:', err.message)
  }
}

if (watch) {
  await watchMode()
} else {
  await build()
}
