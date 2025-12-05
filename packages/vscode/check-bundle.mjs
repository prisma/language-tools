// Quick check to see if the bundle exports are correct
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

try {
  const extension = require('./dist/extension.js')
  console.log('Bundle loaded successfully')
  console.log('activate:', typeof extension.activate)
  console.log('deactivate:', typeof extension.deactivate)
  console.log('Keys:', Object.keys(extension))
} catch (e) {
  console.error('Error loading bundle:', e.message)
}
