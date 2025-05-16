export const regions = ['us-east-1', 'eu-west-3', 'ap-northeast-1'] as const
export type Region = (typeof regions)[number]

export function isValidRegion(value: string): value is Region {
  return (regions as readonly string[]).includes(value)
}
