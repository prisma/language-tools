import {
  export_variations,
  import_variations,
  page_export_variations,
} from '../__fixtures__/variations'
type KeyOfImportVars = keyof typeof import_variations
type KeyOfExportVars = keyof typeof export_variations
type KeyOfPageExportVar = keyof typeof page_export_variations

export type Filter = (value: string, index: number, array: string[]) => boolean
export type FileExtension = 'js' | 'jsx' | 'ts' | 'tsx'
/**
 * This builds different variations of import/export and nextjs page statements. Only used for testing
 */
export function buildVariations(
  extension: FileExtension,
  filter?: {
    import?: Filter
    export?: Filter
    page?: Filter
  },
): { [filename: string]: string } {
  const variations = {} as { [filename: string]: string }
  // Please no comments on this
  const filtered_import_variations_keys: KeyOfImportVars[] = filter?.import
    ? (Object.keys(import_variations).filter(
        filter?.import,
      ) as KeyOfImportVars[])
    : (Object.keys(import_variations) as KeyOfImportVars[])
  const filtered_export_variations_keys: KeyOfExportVars[] = filter?.export
    ? (Object.keys(export_variations).filter(
        filter?.export,
      ) as KeyOfExportVars[])
    : (Object.keys(export_variations) as KeyOfExportVars[])
  const filtered_page_export_variations_keys: KeyOfPageExportVar[] = filter?.page
    ? (Object.keys(page_export_variations).filter(
        filter?.page,
      ) as KeyOfPageExportVar[])
    : (Object.keys(page_export_variations) as KeyOfPageExportVar[])

  filtered_import_variations_keys.forEach((imp_var_name) => {
    filtered_export_variations_keys.forEach((exp_var_name) => {
      filtered_page_export_variations_keys.forEach((page_exp_var_name) => {
        const testFileName = `${imp_var_name}_and_${exp_var_name}_and_${page_exp_var_name}.${extension}`
        variations[testFileName] =
          import_variations[imp_var_name] +
          export_variations[exp_var_name] +
          page_export_variations[page_exp_var_name]
      })
    })
  })
  return variations
}
