import { useEffect, useMemo, useRef, useState } from 'react'
import BrainScene from './BrainScene'
import { brainMeasures, corticalStats, downloadAssets, regionNotes, reportAssets } from './data'
import type { DataMode, RegionSelection, ViewMode } from './types'

const mindStates = [
  {
    id: 'daydreamer',
    label: 'Daydreamer',
    regions: ['precuneus', 'posteriorcingulate', 'rostralmiddlefrontal', 'superiorfrontal', 'inferiorparietal', 'middletemporal'],
  },
  {
    id: 'observer',
    label: 'World Observer',
    regions: ['lateraloccipital', 'pericalcarine', 'cuneus', 'fusiform', 'superiorparietal', 'postcentral'],
  },
  {
    id: 'meditator',
    label: 'Meditator',
    regions: ['rostralanteriorcingulate', 'caudalanteriorcingulate', 'insula', 'superiorfrontal', 'precuneus', 'parahippocampal'],
  },
] as const

type MindStateId = typeof mindStates[number]['id']

const reports = [
  {
    id: 'wais', index: '01', title: 'WAIS–RC', subtitle: 'Wechsler Adult Intelligence Scale', date: '08 JUN 2026',
    metric: '121', label: 'Full-scale IQ', percentile: '92.5th percentile', pages: [reportAssets.wais1, reportAssets.wais2], note: 'Verbal IQ 127 · Performance IQ 108',
    translation: {
      heading: 'English translation · WAIS–RC result analysis',
      summary: 'The Chinese Revised Wechsler Adult Intelligence Scale was administered to assess verbal, performance, and full-scale intellectual functioning.',
      metrics: [['Verbal IQ', '127', '96.6th percentile'], ['Performance IQ', '108', '72.2nd percentile'], ['Full-scale IQ', '121', '92.5th percentile']],
      details: [['Knowledge', '14'], ['Comprehension', '16'], ['Arithmetic', '13'], ['Similarities', '13'], ['Digit span', '15'], ['Vocabulary', '14'], ['Digit symbol', '17'], ['Picture completion', '9'], ['Block design', '14'], ['Picture arrangement', '11'], ['Object assembly', '8']],
      interpretation: 'The report describes a significant verbal–performance difference. Relative strengths include eye–hand coordination, visual-motor speed, visual attention, and memory. Relative weaknesses were reported in perceiving and analyzing objects and distinguishing essential from non-essential details.',
    },
  },
  {
    id: 'memory', index: '02', title: 'Clinical Memory', subtitle: 'Five-domain cognitive profile', date: '30 JUL 2025',
    metric: '5', label: 'Cognitive domains', percentile: 'One integrated profile', pages: [reportAssets.memory], note: 'Processing · Working · Episodic · Spatial · Language',
    translation: {
      heading: 'English translation · Clinical Memory Test',
      summary: 'Five task-derived domains were compared with age-group reference ranges. The original report notes that results are for clinical reference and are not a final diagnosis.',
      metrics: [['Processing speed', '49', '47.3rd percentile'], ['Working memory', '62', '78.8th percentile'], ['Episodic memory', '13', '0.7th percentile'], ['Visuospatial ability', '79', '97.3rd percentile'], ['Language comprehension', '71', '91.9th percentile']],
      details: [['Symbol search', 'Processing speed'], ['Symmetry span', 'Working memory'], ['Face memory', 'Episodic memory'], ['Paper folding', 'Visuospatial ability'], ['Vocabulary test', 'Language comprehension']],
      interpretation: 'The source report flags processing speed and episodic memory as impaired, while showing high visuospatial and language-comprehension scores. This translation reproduces the report rather than offering an independent clinical interpretation.',
    },
  },
  {
    id: 'crt', index: '03', title: 'CRT', subtitle: 'Combined Raven’s Test', date: '2025',
    metric: '136', label: 'Estimated IQ', percentile: 'Extremely superior', pages: [reportAssets.crt], note: 'Raw score 72 · All six units scored 12',
    translation: {
      heading: 'English translation · Combined Raven’s Test',
      summary: 'The Combined Raven’s Test is a non-verbal measure of abstract reasoning. All six units—A, AB, B, C, D, and E—received a score of 12.',
      metrics: [['Total score', '72', 'Maximum recorded'], ['Estimated IQ', '136', 'Extremely superior']],
      details: [['Unit A', '12'], ['Unit AB', '12'], ['Unit B', '12'], ['Unit C', '12'], ['Unit D', '12'], ['Unit E', '12']],
      interpretation: 'The original result classifies the estimated intelligence score as “extremely superior.” As stated on the source document, scale results may be influenced by clinical state and are provided for reference.',
    },
  },
  {
    id: 'adhd', index: '04', title: 'ASRS', subtitle: 'Adult ADHD screening', date: '2025',
    metric: '25', label: 'Inattention score', percentile: 'Reference value 16', pages: [reportAssets.adhd], note: 'Hyperactivity / impulsivity 25 · Reference 16',
    translation: {
      heading: 'English translation · Adult ADHD Self-Report Scale',
      summary: 'The Adult ADHD Self-Report Scale (ASRS) screens attention-deficit and hyperactivity/impulsivity symptoms. It is a screening instrument, not a stand-alone diagnosis.',
      metrics: [['Inattention', '25', 'Reference value 16'], ['Hyperactivity / impulsivity', '25', 'Reference value 16']],
      details: [['Screening result', 'Elevated risk'], ['Suggested follow-up', 'Consult a qualified clinician']],
      interpretation: 'The source report states that both domains were elevated and that the current risk of adult ADHD is high. It recommends professional consultation to develop any further treatment or intervention plan.',
    },
  },
]

const downloads: Array<{
  index: string; type: string; title: string; note: string; size: string;
  href: string; filename: string; secondary?: string; secondaryName?: string;
  tertiary?: string; tertiaryName?: string;
}> = [
  { index: '01', type: 'MRI · MGZ', title: 'Brain Volume', note: 'Skull-stripped, intensity-normalized anatomical volume.', size: '1.4 MB', href: downloadAssets.brain, filename: 'brain.mgz' },
  { index: '02', type: 'SEGMENTATION · MGZ', title: 'Aseg Volume', note: 'Subcortical segmentation and anatomical labels.', size: '368 KB', href: downloadAssets.aseg, filename: 'aseg.mgz' },
  { index: '03', type: 'SURFACE · FREESURFER', title: 'Cortical Surfaces', note: 'Left and right pial cortical surface meshes.', size: '11 MB', href: downloadAssets.lhPial, secondary: downloadAssets.rhPial, filename: 'lh.pial', secondaryName: 'rh.pial' },
  { index: '04', type: 'TRACTOGRAPHY · TCK', title: 'DWI Streamlines', note: 'Full MRtrix tractogram containing 50,000 streamlines.', size: '32 MB', href: downloadAssets.dwiTck, filename: 'tracks_50k.tck' },
  { index: '05', type: 'TRACTOGRAPHY · VTK', title: 'DWI Polydata', note: 'The same tractogram exported as ASCII VTK polydata.', size: '87 MB', href: downloadAssets.dwiVtk, filename: 'tracks_50k.vtk' },
  { index: '06', type: 'STATISTICS · TEXT', title: 'Cortical Statistics', note: 'Regional volume, surface area, and thickness tables.', size: '3 files', href: downloadAssets.lhStats, secondary: downloadAssets.rhStats, tertiary: downloadAssets.asegStats, filename: 'lh.aparc.stats', secondaryName: 'rh.aparc.stats', tertiaryName: 'aseg.stats' },
]

function formatVolume(mm3: number) {
  return mm3 >= 100000 ? `${(mm3 / 1_000_000).toFixed(3)} L` : `${mm3.toLocaleString()} mm³`
}

function LeaderLine({ point, target }: { point?: { x: number; y: number }, target: { x: number; y: number } }) {
  if (!point) return null
  const dx = target.x - point.x, dy = target.y - point.y
  const length = Math.sqrt(dx * dx + dy * dy)
  const angle = Math.atan2(dy, dx) * 180 / Math.PI
  return <div className="leader-line" style={{ left: point.x, top: point.y, width: length, transform: `rotate(${angle}deg)` }}><i /></div>
}

export default function App() {
  const [dataMode, setDataMode] = useState<DataMode>('anatomy')
  const [viewMode, setViewMode] = useState<ViewMode>('both')
  const [autoRotate, setAutoRotate] = useState(true)
  const [selection, setSelection] = useState<RegionSelection | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeReport, setActiveReport] = useState<typeof reports[number] | null>(null)
  const [reportPage, setReportPage] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [hoveredMindState, setHoveredMindState] = useState<MindStateId | null>(null)
  const [lockedMindState, setLockedMindState] = useState<MindStateId | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [lineTarget, setLineTarget] = useState({ x: 0, y: 0 })

  const defaultRegion = useMemo(() => corticalStats.find(r => r.hemi === 'lh' && r.key === 'superiorfrontal')!, [])
  const meanParcelVolume = useMemo(() => corticalStats.reduce((sum, region) => sum + region.grayVolume, 0) / corticalStats.length, [])
  const shown = selection ?? { ...defaultRegion, code: 0 }
  const relativeToMean = (shown.grayVolume / meanParcelVolume) * 100
  const activeMindStateId = hoveredMindState ?? lockedMindState
  const activeMindState = mindStates.find(state => state.id === activeMindStateId)

  const previewMindState = (id: MindStateId) => {
    setDataMode('anatomy')
    setHoveredMindState(id)
  }

  const toggleMindState = (id: MindStateId) => {
    setDataMode('anatomy')
    setLockedMindState(current => current === id ? null : id)
  }

  useEffect(() => {
    const update = () => {
      const stage = stageRef.current?.getBoundingClientRect()
      const card = cardRef.current?.getBoundingClientRect()
      if (stage && card) setLineTarget({ x: card.left - stage.left, y: card.top - stage.top + 47 })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [selection])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveReport(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const openReport = (report: typeof reports[number]) => { setActiveReport(report); setReportPage(0) }

  return (
    <main>
      <section className="hero" id="brain">
        <header className="site-header">
          <a className="brand" href="#brain" aria-label="Marvin's Open-Source Body Program home"><span>MARVIN’S OPEN-SOURCE BODY PROGRAM</span></a>
          <nav className={menuOpen ? 'open' : ''}>
            <a href="#brain" onClick={() => setMenuOpen(false)}>Explore</a>
            <a href="#cognition" onClick={() => setMenuOpen(false)}>Cognition</a>
            <a href="#download" onClick={() => setMenuOpen(false)}>Download</a>
            <a href="#about" onClick={() => setMenuOpen(false)}>About</a>
          </nav>
          <button className="menu-button" onClick={() => setMenuOpen(v => !v)} aria-label="Toggle navigation">{menuOpen ? '×' : '≡'}</button>
        </header>

        <div className="hero-copy">
          <h1>Meet with<br /><em>my brain 👋</em></h1>
          <p className="intro">I have chosen to make my mind open source. To me, this is the most romantic thing I can do. In novel <i>The Three-Body Problem</i>, Yun Tianming “sent only his brain” into the unknown. In my own way, I want to do the same, by offering my cognitive data for anyone I love, anyone who loves me, my friends, or researchers to explore, understand, and analyze the patterns of my mind and personality.</p>
        </div>

        <div className="brain-stage" ref={stageRef}>
          <BrainScene dataMode={dataMode} viewMode={viewMode} autoRotate={autoRotate} highlightedRegions={activeMindState?.regions ?? []} onSelect={setSelection} onLoading={setLoading} />
          {loading && <div className="brain-loader"><span /><p>RECONSTRUCTING CORTICAL SURFACE</p><small>149,495 + 146,427 vertices</small></div>}
          <div className="axis-labels" aria-hidden="true"><span className="axis-a">A</span><span className="axis-p">P</span><span className="axis-l">L</span><span className="axis-r">R</span></div>
          {dataMode === 'anatomy' && <LeaderLine point={selection?.screen} target={lineTarget} />}

          <div className="view-controls" aria-label="Brain view controls">
            <button className={dataMode === 'anatomy' ? 'active mode-button' : 'mode-button'} onClick={() => setDataMode('anatomy')}>Anatomy</button>
            <button className={dataMode === 'dwi' ? 'active mode-button' : 'mode-button'} onClick={() => setDataMode('dwi')}>DWI</button>
            <span />
            {dataMode === 'anatomy' && <>{(['both', 'lh', 'rh'] as ViewMode[]).map(mode => <button key={mode} className={viewMode === mode ? 'active' : ''} onClick={() => setViewMode(mode)}>{mode === 'both' ? 'Bilateral' : mode.toUpperCase()}</button>)}<span /></>}
            <button className={autoRotate ? 'active' : ''} onClick={() => setAutoRotate(v => !v)} aria-pressed={autoRotate}>↻ Auto</button>
          </div>

          <div className="mind-states" aria-label="Explore functional networks associated with three traits">
            <div className="mind-states-line">
              <span>I’m a</span>
              {mindStates.map((state, index) => <span className="mind-state-item" key={state.id}>
                <button
                  className={activeMindStateId === state.id ? 'active' : ''}
                  onPointerEnter={() => previewMindState(state.id)}
                  onPointerLeave={() => setHoveredMindState(null)}
                  onFocus={() => previewMindState(state.id)}
                  onBlur={() => setHoveredMindState(null)}
                  onClick={() => toggleMindState(state.id)}
                  aria-pressed={lockedMindState === state.id}
                >{state.label}</button>
                {index < mindStates.length - 1 && <i aria-hidden="true">,</i>}
              </span>)}
            </div>
          </div>

          {dataMode === 'anatomy' ? <aside className="region-card" ref={cardRef}>
            <div className="region-index">{shown.hemi === 'lh' ? 'LH' : 'RH'} · DK-{String(corticalStats.filter(r => r.hemi === shown.hemi).findIndex(r => r.key === shown.key) + 1).padStart(2, '0')}</div>
            <p className="region-side">{shown.hemi === 'lh' ? 'LEFT HEMISPHERE' : 'RIGHT HEMISPHERE'}</p>
            <h2>{shown.name}</h2>
            <p className="region-note">{regionNotes[shown.key] ?? 'A cortical parcel defined by the Desikan–Killiany anatomical atlas.'}</p>
            <div className="region-metrics">
              <div><span>GRAY MATTER VOLUME</span><strong>{shown.grayVolume.toLocaleString()} <small>mm³</small></strong></div>
              <div><span>MEAN THICKNESS</span><strong>{shown.thickness.toFixed(2)} <small>mm</small></strong></div>
              <div><span>SURFACE AREA</span><strong>{shown.surfaceArea.toLocaleString()} <small>mm²</small></strong></div>
              <div><span>HEMISPHERE SHARE</span><strong>{shown.share.toFixed(2)}<small>%</small></strong></div>
            </div>
            <p className="atlas-note">PARCELLATION · DESIKAN–KILLIANY 2006</p>
          </aside> : <aside className="region-card dwi-card" ref={cardRef}>
            <div className="region-index">DWI · iFOD2</div>
            <p className="region-side">DIFFUSION TRACTOGRAPHY</p>
            <h2>White-matter<br />streamlines</h2>
            <p className="region-note">A direction-encoded rendering of Marvin’s diffusion-derived tractogram. Color indicates local fiber direction: left–right, superior–inferior, and anterior–posterior.</p>
            <div className="region-metrics">
              <div><span>FULL DATASET</span><strong>50,000</strong></div>
              <div><span>WEB SUBSET</span><strong>5,000</strong></div>
              <div><span>ALGORITHM</span><strong><small>iFOD2</small></strong></div>
              <div><span>STEP SIZE</span><strong>.899 <small>mm</small></strong></div>
            </div>
            <div className="direction-legend"><i /><span>LR</span><i /><span>SI</span><i /><span>AP</span></div>
            <p className="atlas-note">SOURCE · MRTRIX 3.0.8 · VISUALIZATION SUBSET</p>
          </aside>}
        </div>

        <div className="hero-hint"><span className="mouse-icon" /> DRAG TO ROTATE · SCROLL TO ZOOM · HOVER TO INSPECT</div>
        <a className="scroll-cue" href="#cognition"><span>01</span><i /><small>COGNITION</small></a>
      </section>

      <section className="anatomy-strip" aria-label="Anatomical summary">
        <div><span>SEGMENTED VOLUME</span><strong>{formatVolume(brainMeasures.segmentedVolume)}</strong></div>
        <div><span>CORTICAL GRAY</span><strong>{formatVolume(brainMeasures.corticalGray)}</strong></div>
        <div><span>WHITE MATTER</span><strong>{formatVolume(brainMeasures.whiteMatter)}</strong></div>
        <div><span>CORTICAL PARCELS</span><strong>68</strong></div>
        <div><span>PIPELINE</span><strong>FreeSurfer 7.1.1</strong></div>
      </section>

      <section className="cognition" id="cognition">
        <div className="section-heading">
          <div><p className="eyebrow">02 / COGNITIVE PHENOTYPE</p><h2>Be closer,<br /><em>to cognition.</em></h2></div>
          <p>Standardized cognitive assessments, presented as a traceable companion to the anatomy. Select a report to read the original document or download the source image.</p>
        </div>

        <div className="report-grid">
          {reports.map(report => (
            <button className="report-card" key={report.id} onClick={() => openReport(report)}>
              <div className="report-top"><span>{report.index}</span><small>{report.date}</small></div>
              <h3>{report.title}</h3><p>{report.subtitle}</p>
              <div className="report-score"><strong>{report.metric}</strong><span>{report.label}<br /><small>{report.percentile}</small></span></div>
              <p className="report-note">{report.note}</p>
              <div className="view-report">VIEW ORIGINAL <i>↗</i></div>
            </button>
          ))}
        </div>
        <p className="clinical-note">These records are shared for personal research and transparency, not as medical advice or a normative reference.</p>
      </section>

      <section className="downloads" id="download">
        <div className="section-heading download-heading">
          <div><p className="eyebrow">03 / DOWNLOAD</p><h2>Get the data.<br /><em>Do what you want.</em></h2></div>
          <p>Processed neuroimaging derivatives used by this site are available in their native research formats. More in the <a href="https://github.com/MarvinCui/MarvinsBrainProgram" target="_blank" rel="noreferrer">GitHub Repository ↗</a> of this project.</p>
        </div>
        <div className="download-grid">
          {downloads.map(item => <article className="download-card" key={item.index}>
            <div className="download-index">{item.index}</div>
            <p>{item.type}</p><h3>{item.title}</h3><span>{item.note}</span>
            <div className="download-meta"><small>{item.size}</small><div><a href={item.href} download={item.filename}>DOWNLOAD {item.filename} ↓</a>{item.secondary && <a href={item.secondary} download={item.secondaryName}>DOWNLOAD {item.secondaryName} ↓</a>}{item.tertiary && <a href={item.tertiary} download={item.tertiaryName}>DOWNLOAD {item.tertiaryName} ↓</a>}</div></div>
          </article>)}
        </div>
      </section>

      <section className="about no-index" id="about">
        <div><p className="eyebrow">MARVIN’S OPEN-SOURCE BODY PROGRAM</p><h2>Meet with<br />Marvin's Brain<br /><em>(and mind)</em></h2></div>
        <div className="about-copy">
          <p>Hi, I’m Marvin, a neuroscience student exploring my own mind. This is the first work in Marvin’s Open-Source Body Program: a public archive of experiments, data, and questions about my brain and body (including clinical data, medications, medical examinations, and more).</p>
          <p>My goal is for this project to eventually develop into a database containing a comprehensive collection of my physiological data. I started this project because an increasing number of life scientists are recognizing the complexity and individuality of each person. Research is gradually shifting from cross-sectional studies toward a longitudinal research paradigm. A well-constructed personal database could help reduce the cost and difficulty of this process.</p>
          <p>The data presented here were collected and processed while I was a research intern at the <a href="https://cuilab.cibr.ac.cn" target="_blank" rel="noreferrer">Cui Zaixu Laboratory ↗</a> at the Chinese Institute for Brain Research, Beijing (CIBR), where I participated as the subject. In addition to structural MRI and diffusion-weighted imaging (DWI), I underwent 30 sessions of intensive fMRI sampling. Since these data are still being processed, they cannot currently be made publicly available. I will update this website and release them at an appropriate time in the future.</p>
          <p>The cortical surface was reconstructed from my personal T1-weighted MRI and anatomically parcellated using FreeSurfer. Every measurement displayed here is directly extracted from the accompanying statistics files.</p>
        </div>
      </section>

      <footer><a className="brand" href="#brain"><span>MARVIN’S OPEN-SOURCE BODY PROGRAM</span></a><p>Copyright (c) 2026 Boran Cui</p><a href="#brain">BACK TO CORTEX ↑</a></footer>

      {activeReport && <div className="report-modal" role="dialog" aria-modal="true" aria-label={`${activeReport.title} original report`}>
        <button className="modal-backdrop" onClick={() => setActiveReport(null)} aria-label="Close report" />
        <div className="modal-panel">
          <div className="modal-header"><div><span>ORIGINAL RECORD · {activeReport.index}</span><h2>{activeReport.title}</h2></div><div className="modal-actions"><a href={activeReport.pages[reportPage]} download>DOWNLOAD JPG ↓</a><button onClick={() => setActiveReport(null)} aria-label="Close">×</button></div></div>
          <div className="document-stage">
            <article className="translation-sheet">
              <div className="translation-label">EN / TRANSLATED RECORD</div>
              <h3>{activeReport.translation.heading}</h3>
              <p>{activeReport.translation.summary}</p>
              <div className="translated-metrics">{activeReport.translation.metrics.map(metric => <div key={metric[0]}><span>{metric[0]}</span><strong>{metric[1]}</strong><small>{metric[2]}</small></div>)}</div>
              <div className="translated-details">{activeReport.translation.details.map(detail => <div key={detail[0]}><span>{detail[0]}</span><strong>{detail[1]}</strong></div>)}</div>
              <div className="translated-interpretation"><span>REPORT INTERPRETATION</span><p>{activeReport.translation.interpretation}</p></div>
              <small className="translation-disclaimer">English translation prepared for accessibility. When wording differs, the Chinese source document below is authoritative.</small>
            </article>
            <div className="original-divider"><span>ZH / ORIGINAL CLINICAL DOCUMENT · PAGE {reportPage + 1}</span></div>
            <img src={activeReport.pages[reportPage]} alt={`${activeReport.title} report page ${reportPage + 1}`} />
          </div>
          <div className="modal-footer"><span>PAGE {reportPage + 1} / {activeReport.pages.length}</span>{activeReport.pages.length > 1 && <div><button disabled={reportPage === 0} onClick={() => setReportPage(p => p - 1)}>← PREV</button><button disabled={reportPage === activeReport.pages.length - 1} onClick={() => setReportPage(p => p + 1)}>NEXT →</button></div>}<small>Clinical source document · Chinese original</small></div>
        </div>
      </div>}
    </main>
  )
}
