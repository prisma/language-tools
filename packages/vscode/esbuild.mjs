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
  external: ['vscode'],
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

/**
 * Configuration for the Prisma 6 Language Server.
 * This is bundled separately and used when pinToPrisma6 is enabled.
 * @type {import('esbuild').BuildOptions}
 */
const prisma6LanguageServerConfig = {
  entryPoints: ['src/workers/prisma6-language-server.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  outfile: 'dist/prisma6-language-server/bin.js',
  external: [],
  minify: production,
  sourcemap: !production,
  plugins: [pnpmResolvePlugin, ...(watch ? [esbuildProblemMatcherPlugin] : [])],
  metafile: true,
  logLevel: 'info',
  nodePaths: nodeModulesPaths,
}

/**
 * Configuration for the PPG Dev Server worker.
 * This is a separate bundle that gets forked as a child process when starting
 * a local Prisma Postgres instance.
 * @type {import('esbuild').BuildOptions}
 */
const ppgDevServerConfig = {
  entryPoints: ['src/workers/ppgDevServer.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  outfile: 'dist/workers/ppgDevServer.js',
  external: [],
  minify: production,
  sourcemap: !production,
  plugins: [pnpmResolvePlugin, ...(watch ? [esbuildProblemMatcherPlugin] : [])],
  metafile: true,
  logLevel: 'info',
  nodePaths: nodeModulesPaths,
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

    // Build the Prisma 6 Language Server
    console.log('\nBuilding Prisma 6 Language Server...')
    const prisma6LsResult = await esbuild.build(prisma6LanguageServerConfig)

    if (prisma6LsResult.metafile) {
      const text = await esbuild.analyzeMetafile(prisma6LsResult.metafile)
      console.log('Prisma 6 Language Server bundle analysis:')
      console.log(text)
    }

    // Build the PPG Dev Server worker
    console.log('\nBuilding PPG Dev Server worker...')
    const ppgDevServerResult = await esbuild.build(ppgDevServerConfig)

    if (ppgDevServerResult.metafile) {
      const text = await esbuild.analyzeMetafile(ppgDevServerResult.metafile)
      console.log('PPG Dev Server worker bundle analysis:')
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
  const prisma6LsContext = await esbuild.context(prisma6LanguageServerConfig)
  const ppgDevServerContext = await esbuild.context(ppgDevServerConfig)

  await Promise.all([
    extensionContext.watch(),
    lsContext.watch(),
    prisma6LsContext.watch(),
    ppgDevServerContext.watch(),
  ])

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

  if (!existsSync(studioSrc)) {
    throw new Error(`@prisma/studio-core-licensed not found at ${studioSrc}`)
  }

  console.log('Copying @prisma/studio-core-licensed static assets...')
  // Use dereference to resolve symlinks (important for pnpm)
  cpSync(studioSrc, studioDest, { recursive: true, dereference: true })

  // Copy prisma-schema-wasm WASM file to Prisma 6 language server directory
  // The WASM is loaded via __dirname in the bundled code, so it needs to be
  // in the same directory as the bundled Prisma 6 language server bin.js
  // Note: We need to find the Prisma 6 version specifically since there are
  // two versions (Prisma 6 and Prisma 7) of @prisma/prisma-schema-wasm
  const prisma6LsDistDir = join(__dirname, 'dist/prisma6-language-server')
  mkdirSync(prisma6LsDistDir, { recursive: true })

  // Resolve @prisma/prisma-schema-wasm from prisma-6-language-server's context
  // This ensures we get the correct version (6.x) that prisma-6-language-server depends on
  const prisma6LsPackagePath = dirname(
    require.resolve('prisma-6-language-server/package.json', {
      paths: nodeModulesPaths,
    }),
  )
  const prisma6WasmPackagePath = dirname(
    require.resolve('@prisma/prisma-schema-wasm/package.json', {
      paths: [join(prisma6LsPackagePath, 'node_modules'), ...nodeModulesPaths],
    }),
  )
  const prisma6WasmSrc = join(prisma6WasmPackagePath, 'src/prisma_schema_build_bg.wasm')

  if (!existsSync(prisma6WasmSrc)) {
    throw new Error(`prisma_schema_build_bg.wasm not found at ${prisma6WasmSrc}`)
  }

  console.log('Copying prisma-schema-wasm WASM file for Prisma 6 Language Server...')
  cpSync(prisma6WasmSrc, join(prisma6LsDistDir, 'prisma_schema_build_bg.wasm'))

  // Copy prisma-schema-wasm WASM file to language server directory
  // The WASM is loaded via __dirname in the bundled code, so it needs to be
  // in the same directory as the bundled language server bin.js
  const lsDistDir = join(__dirname, 'dist/language-server')
  mkdirSync(lsDistDir, { recursive: true })

  // Find the prisma-schema-wasm package - resolve from language-server's context
  const lsNodeModules = join(__dirname, '..', 'language-server', 'node_modules')
  const wasmPackagePath = dirname(
    require.resolve('@prisma/prisma-schema-wasm/package.json', {
      paths: [lsNodeModules, ...nodeModulesPaths],
    }),
  )
  const wasmSrc = join(wasmPackagePath, 'src/prisma_schema_build_bg.wasm')

  if (!existsSync(wasmSrc)) {
    throw new Error(`prisma_schema_build_bg.wasm not found at ${wasmSrc}`)
  }

  console.log('Copying prisma-schema-wasm WASM file...')
  cpSync(wasmSrc, join(lsDistDir, 'prisma_schema_build_bg.wasm'))

  // Copy pglite assets for the PPG Dev Server worker
  // PGlite requires these files at runtime and loads them via __dirname
  const workersDistDir = join(__dirname, 'dist/workers')
  mkdirSync(workersDistDir, { recursive: true })

  // @electric-sql/pglite is a transitive dependency through @prisma/dev
  // pnpm's strict node_modules structure means we need to find it in the .pnpm store
  const pnpmStore = join(__dirname, '../../node_modules/.pnpm')
  const pglitePkgDir = readdirSync(pnpmStore).find(
    (dir) => dir.startsWith('@electric-sql+pglite@') && !dir.includes('socket') && !dir.includes('tools'),
  )

  if (!pglitePkgDir) {
    throw new Error('Could not find @electric-sql/pglite package in pnpm store')
  }

  const pgliteDistDir = join(pnpmStore, pglitePkgDir, 'node_modules/@electric-sql/pglite/dist')

  const pgliteAssets = ['pglite.data', 'pglite.wasm']
  for (const asset of pgliteAssets) {
    const assetSrc = join(pgliteDistDir, asset)

    if (!existsSync(assetSrc)) {
      throw new Error(`${asset} not found at ${assetSrc}`)
    }

    console.log(`Copying pglite ${asset}...`)
    cpSync(assetSrc, join(workersDistDir, asset))
  }

  const pgExtensions = [
    'amcheck',
    'bloom',
    'btree_gin',
    'btree_gist',
    'citext',
    'cube',
    'dict_int',
    'dict_xsyn',
    'earthdistance',
    'file_fdw',
    'fuzzystrmatch',
    'hstore',
    'intarray',
    'isn',
    'lo',
    'ltree',
    'pageinspect',
    'pg_buffercache',
    'pg_freespacemap',
    'pg_surgery',
    'pg_trgm',
    'pg_visibility',
    'pg_walinspect',
    'seg',
    'tablefunc',
    'tcn',
    'tsm_system_rows',
    'tsm_system_time',
    'unaccent',
    'uuid-ossp',
    'vector',
  ]

  for (const extension of pgExtensions) {
    const extensionGzip = `${extension}.tar.gz`

    const gzipSrc = join(pgliteDistDir, extensionGzip)

    if (!existsSync(gzipSrc)) {
      throw new Error(`${extension} not found at ${gzipSrc}`)
    }

    console.log(`Copying pglite ${extension}...`)
    cpSync(gzipSrc, join(workersDistDir, '..', extensionGzip))
  }
}

if (watch) {
  await watchMode()
} else {
  await build()
}
