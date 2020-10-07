import {
  export_variations,
  import_variations,
  page_export_variations,
} from '../__fixtures__/variations'
type KeyOf = keyof typeof import_variations
type KeyOfo = keyof typeof export_variations
type KeyOfoo = keyof typeof page_export_variations

type Filter = (value: string, index: number, array: string[]) => boolean
type Extension = 'js' | 'jsx' | 'ts' | 'tsx'
export function buildVariations(
  extension: Extension,
  filter?: {
    import?: Filter
    export?: Filter
    page?: Filter
  },
): { [filename: string]: string } {
  const variations = {} as { [filename: string]: string }
  // Please no comments on this
  const filtered_import_variations_keys: KeyOf[] = filter?.import
    ? (Object.keys(import_variations).filter(filter?.import) as KeyOf[])
    : (Object.keys(import_variations) as KeyOf[])
  const filtered_export_variations_keys: KeyOfo[] = filter?.export
    ? (Object.keys(export_variations).filter(filter?.export) as KeyOfo[])
    : (Object.keys(export_variations) as KeyOfo[])
  const filtered_page_export_variations_keys: KeyOfoo[] = filter?.page
    ? (Object.keys(page_export_variations).filter(filter?.page) as KeyOfoo[])
    : (Object.keys(page_export_variations) as KeyOfoo[])

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
