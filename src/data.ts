import lhStatsRaw from '../Datas/freesurfer_source/stats/lh.aparc.stats?raw'
import rhStatsRaw from '../Datas/freesurfer_source/stats/rh.aparc.stats?raw'
import brainStatsRaw from '../Datas/freesurfer_source/stats/brainvol.stats?raw'
import type { Hemisphere, RegionStats } from './types'

export const assetUrls = {
  lhSurface: new URL('../Datas/freesurfer_source/surf/lh.pial', import.meta.url).href,
  rhSurface: new URL('../Datas/freesurfer_source/surf/rh.pial', import.meta.url).href,
  lhAnnot: new URL('../Datas/freesurfer_source/label/lh.aparc.annot', import.meta.url).href,
  rhAnnot: new URL('../Datas/freesurfer_source/label/rh.aparc.annot', import.meta.url).href,
  dwiPreview: new URL('../Datas/dwi/tracks_5k_preview.bin', import.meta.url).href,
}

const displayNames: Record<string, string> = {
  bankssts: 'Banks of the superior temporal sulcus',
  caudalanteriorcingulate: 'Caudal anterior cingulate',
  caudalmiddlefrontal: 'Caudal middle frontal',
  cuneus: 'Cuneus', entorhinal: 'Entorhinal cortex', fusiform: 'Fusiform gyrus',
  inferiorparietal: 'Inferior parietal lobule', inferiortemporal: 'Inferior temporal gyrus',
  isthmuscingulate: 'Isthmus of cingulate', lateraloccipital: 'Lateral occipital cortex',
  lateralorbitofrontal: 'Lateral orbitofrontal cortex', lingual: 'Lingual gyrus',
  medialorbitofrontal: 'Medial orbitofrontal cortex', middletemporal: 'Middle temporal gyrus',
  parahippocampal: 'Parahippocampal gyrus', paracentral: 'Paracentral lobule',
  parsopercularis: 'Pars opercularis', parsorbitalis: 'Pars orbitalis',
  parstriangularis: 'Pars triangularis', pericalcarine: 'Pericalcarine cortex',
  postcentral: 'Postcentral gyrus', posteriorcingulate: 'Posterior cingulate',
  precentral: 'Precentral gyrus', precuneus: 'Precuneus',
  rostralanteriorcingulate: 'Rostral anterior cingulate', rostralmiddlefrontal: 'Rostral middle frontal',
  superiorfrontal: 'Superior frontal gyrus', superiorparietal: 'Superior parietal lobule',
  superiortemporal: 'Superior temporal gyrus', supramarginal: 'Supramarginal gyrus',
  frontalpole: 'Frontal pole', temporalpole: 'Temporal pole',
  transversetemporal: 'Transverse temporal cortex', insula: 'Insula', unknown: 'Unclassified cortex',
}

export const regionNotes: Record<string, string> = {
  superiorfrontal: 'Associated with working memory, metacognition, and executive control.',
  rostralmiddlefrontal: 'Part of prefrontal systems supporting planning, monitoring, and cognitive flexibility.',
  caudalmiddlefrontal: 'Linked to executive attention, response selection, and working-memory control.',
  precentral: 'The primary motor strip; central to voluntary movement and motor output.',
  postcentral: 'The primary somatosensory strip; maps touch and body-position signals.',
  superiorparietal: 'Supports visuospatial attention, sensorimotor integration, and spatial working memory.',
  inferiorparietal: 'Contributes to attention, semantic processing, and multisensory integration.',
  supramarginal: 'Involved in phonological processing, action representation, and social perception.',
  precuneus: 'A highly connected hub involved in internally directed thought and visuospatial imagery.',
  lateraloccipital: 'Supports visual shape, object, and scene processing.',
  pericalcarine: 'Contains primary visual cortex and the first cortical stage of visual processing.',
  cuneus: 'Contributes to early visual processing and visuospatial integration.',
  lingual: 'Involved in visual recognition, imagery, and processing of complex scenes.',
  fusiform: 'Supports high-level visual recognition, including faces, words, and object categories.',
  superiortemporal: 'Participates in auditory, language, and social-perceptual processing.',
  middletemporal: 'Supports semantic memory, language comprehension, and motion perception.',
  inferiortemporal: 'A high-level visual association area important for object identity.',
  transversetemporal: 'Houses primary auditory cortex and early cortical sound processing.',
  temporalpole: 'Integrates semantic, emotional, and social information.',
  entorhinal: 'A gateway between neocortex and hippocampus, central to memory and spatial coding.',
  parahippocampal: 'Supports contextual memory, scenes, and spatial navigation.',
  insula: 'Integrates bodily state, salience, emotion, and subjective awareness.',
  posteriorcingulate: 'A default-mode hub involved in memory and internally directed cognition.',
  caudalanteriorcingulate: 'Contributes to conflict monitoring, action selection, and cognitive control.',
  rostralanteriorcingulate: 'Associated with affective evaluation and regulation.',
  lateralorbitofrontal: 'Supports valuation, updating, and flexible choice when outcomes change.',
  medialorbitofrontal: 'Represents subjective value and reward-related information.',
  parsopercularis: 'Part of inferior frontal language and action-observation systems.',
  parstriangularis: 'Contributes to controlled language retrieval and semantic selection.',
  parsorbitalis: 'Links semantic and affective information within ventral prefrontal cortex.',
  frontalpole: 'Supports abstract goals, prospective memory, and integrating concurrent plans.',
  paracentral: 'Contains medial motor and sensory representations, especially for the lower body.',
  isthmuscingulate: 'Links posterior cingulate and medial temporal memory networks.',
  bankssts: 'A multisensory association region near networks for biological motion and social cues.',
}

function parseCorticalStats(raw: string, hemi: Hemisphere): RegionStats[] {
  const rows = raw.split('\n').filter(line => line.trim() && !line.startsWith('#')).map(line => {
    const [key, vertices, surfaceArea, grayVolume, thickness, thicknessStd] = line.trim().split(/\s+/)
    return {
      hemi, key, name: displayNames[key] ?? key,
      vertices: Number(vertices), surfaceArea: Number(surfaceArea), grayVolume: Number(grayVolume),
      thickness: Number(thickness), thicknessStd: Number(thicknessStd), share: 0,
    }
  })
  const total = rows.reduce((sum, row) => sum + row.grayVolume, 0)
  return rows.map(row => ({ ...row, share: (row.grayVolume / total) * 100 }))
}

export const corticalStats = [...parseCorticalStats(lhStatsRaw, 'lh'), ...parseCorticalStats(rhStatsRaw, 'rh')]
export const corticalStatsByKey = new Map(corticalStats.map(item => [`${item.hemi}:${item.key}`, item]))

function measure(key: string) {
  const line = brainStatsRaw.split('\n').find(row => row.includes(`# Measure ${key},`))
  return line ? Number(line.split(',')[3].trim()) : 0
}

export const brainMeasures = {
  segmentedVolume: measure('BrainSeg'),
  corticalGray: measure('Cortex'),
  totalGray: measure('TotalGray'),
  whiteMatter: measure('CerebralWhiteMatter'),
  leftCortex: measure('lhCortex'),
  rightCortex: measure('rhCortex'),
}

export const reportAssets = {
  crt: new URL('../CogTests/Cog_Test_CRT.JPG', import.meta.url).href,
  memory: new URL('../CogTests/Cog_Test_Memory.JPG', import.meta.url).href,
  adhd: new URL('../CogTests/Cog_Questionnaire_ADHDScreening.JPG', import.meta.url).href,
  wais1: new URL('../CogTests/Cog_Test_WAIS-RC_01.JPG', import.meta.url).href,
  wais2: new URL('../CogTests/Cog_Test_WAIS-RC_02.JPG', import.meta.url).href,
}

export const downloadAssets = {
  brain: new URL('../Datas/freesurfer_source/mri/brain.mgz', import.meta.url).href,
  aseg: new URL('../Datas/freesurfer_source/mri/aseg.mgz', import.meta.url).href,
  lhPial: new URL('../Datas/freesurfer_source/surf/lh.pial', import.meta.url).href,
  rhPial: new URL('../Datas/freesurfer_source/surf/rh.pial', import.meta.url).href,
  lhStats: new URL('../Datas/freesurfer_source/stats/lh.aparc.stats', import.meta.url).href,
  rhStats: new URL('../Datas/freesurfer_source/stats/rh.aparc.stats', import.meta.url).href,
  asegStats: new URL('../Datas/freesurfer_source/stats/aseg.stats', import.meta.url).href,
  dwiTck: new URL('../Datas/dwi/tracks_50k.tck', import.meta.url).href,
  dwiVtk: new URL('../Datas/dwi/tracks_50k.vtk', import.meta.url).href,
}
