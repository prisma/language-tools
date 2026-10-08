import path from 'node:path'
import { spawnSync } from 'node:child_process'

interface PackageManagerFixture {
  readonly name: string
  readonly command: string
  readonly args: readonly string[]
}

function packageDirectory(packageName: string): string {
  return path.dirname(require.resolve(`${packageName}/package.json`))
}

function getPackageManagerFixtures(): PackageManagerFixture[] {
  return [
    {
      name: 'npm',
      command: process.execPath,
      args: [path.join(packageDirectory('npm'), 'bin', 'npm-cli.js'), 'ci', '--no-audit', '--no-fund'],
    },
    {
      name: 'yarn',
      command: process.execPath,
      args: [path.join(packageDirectory('@yarnpkg/cli-dist'), 'bin', 'yarn.js'), 'install', '--immutable'],
    },
    {
      name: 'bun',
      command: path.join(packageDirectory('bun'), 'bin', 'bun.exe'),
      args: ['install', '--frozen-lockfile'],
    },
  ]
}

export function installPackageManagerFixtures(fixturesPath: string): void {
  for (const fixture of getPackageManagerFixtures()) {
    console.log(`*** Installing the ${fixture.name} fixture ***`)
    const result = spawnSync(fixture.command, fixture.args, {
      cwd: path.join(fixturesPath, fixture.name),
      stdio: 'inherit',
    })
    if (result.error) {
      throw result.error
    }
    if (result.status !== 0) {
      throw new Error(`Installing the ${fixture.name} fixture exited with code ${String(result.status)}`)
    }
  }
}
