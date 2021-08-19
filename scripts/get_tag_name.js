if (require.main === module) {
  const args = process.argv.slice(2)
  const releaseChannel = args[0]
  const vscodeVersion = args[1]

  if (releaseChannel === 'latest') {
    console.log(`::set-output name=tag_name::${vscodeVersion}`)
    console.log(`::set-output name=asset_name::prisma`)
  } else {
    console.log(`::set-output name=tag_name::insider/${vscodeVersion}`)
    console.log(`::set-output name=asset_name::prisma-insider`)
  }
}
