export type Hemisphere = 'lh' | 'rh'

export type RegionStats = {
  hemi: Hemisphere
  key: string
  name: string
  vertices: number
  surfaceArea: number
  grayVolume: number
  thickness: number
  thicknessStd: number
  share: number
}

export type RegionSelection = RegionStats & {
  code: number
  screen?: { x: number; y: number }
}

export type ViewMode = 'both' | 'lh' | 'rh'
export type DataMode = 'anatomy' | 'dwi'
