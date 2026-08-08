import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { assetUrls, corticalStatsByKey } from './data'
import type { DataMode, Hemisphere, RegionSelection, ViewMode } from './types'

type Annotation = { values: Uint32Array; names: Map<number, string> }
type BrainMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial> & {
  userData: { hemi: Hemisphere; annot: Annotation; baseColors: Float32Array; lastCode?: number }
}

type Props = {
  dataMode: DataMode
  viewMode: ViewMode
  autoRotate: boolean
  onSelect: (selection: RegionSelection | null) => void
  onLoading: (loading: boolean) => void
}

const palette = ['#81e6d2', '#57c5b6', '#62aeb3', '#8bd8bd', '#6fb5a3', '#a3d9c9', '#5dc8a5']

function hashColor(name: string) {
  let hash = 0
  for (const char of name) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0
  return new THREE.Color(palette[Math.abs(hash) % palette.length])
}

function readSurface(buffer: ArrayBuffer) {
  const view = new DataView(buffer)
  let offset = 3
  for (let lines = 0; lines < 2; lines++) {
    while (offset < view.byteLength && view.getUint8(offset++) !== 10) { /* header */ }
  }
  const vertexCount = view.getInt32(offset, false); offset += 4
  const faceCount = view.getInt32(offset, false); offset += 4
  const positions = new Float32Array(vertexCount * 3)
  for (let i = 0; i < vertexCount; i++) {
    const x = view.getFloat32(offset, false); offset += 4
    const y = view.getFloat32(offset, false); offset += 4
    const z = view.getFloat32(offset, false); offset += 4
    positions[i * 3] = x
    positions[i * 3 + 1] = z
    positions[i * 3 + 2] = -y
  }
  const indices = new Uint32Array(faceCount * 3)
  for (let i = 0; i < indices.length; i++) { indices[i] = view.getInt32(offset, false); offset += 4 }
  return { positions, indices }
}

function readString(view: DataView, state: { offset: number }) {
  const length = view.getInt32(state.offset, false); state.offset += 4
  const bytes = new Uint8Array(view.buffer, state.offset, Math.max(0, length)); state.offset += Math.max(0, length)
  return new TextDecoder().decode(bytes).replace(/\0+$/, '')
}

function readAnnotation(buffer: ArrayBuffer): Annotation {
  const view = new DataView(buffer)
  const state = { offset: 0 }
  const vertexCount = view.getInt32(state.offset, false); state.offset += 4
  const values = new Uint32Array(vertexCount)
  for (let i = 0; i < vertexCount; i++) {
    const vertex = view.getInt32(state.offset, false); state.offset += 4
    values[vertex] = view.getUint32(state.offset, false); state.offset += 4
  }
  const names = new Map<number, string>()
  if (state.offset + 8 > view.byteLength || view.getInt32(state.offset, false) === 0) return { values, names }
  state.offset += 4
  const entries = view.getInt32(state.offset, false); state.offset += 4
  if (entries > 0) {
    readString(view, state)
    for (let i = 0; i < entries; i++) {
      const name = readString(view, state)
      const r = view.getInt32(state.offset, false); state.offset += 4
      const g = view.getInt32(state.offset, false); state.offset += 4
      const b = view.getInt32(state.offset, false); state.offset += 4
      const a = view.getInt32(state.offset, false); state.offset += 4
      names.set((r + g * 256 + b * 65536 + a * 16777216) >>> 0, name)
    }
  } else {
    const version = -entries
    if (version !== 2) return { values, names }
    state.offset += 4
    readString(view, state)
    const toRead = view.getInt32(state.offset, false); state.offset += 4
    for (let i = 0; i < toRead; i++) {
      state.offset += 4
      const name = readString(view, state)
      const r = view.getInt32(state.offset, false); state.offset += 4
      const g = view.getInt32(state.offset, false); state.offset += 4
      const b = view.getInt32(state.offset, false); state.offset += 4
      const a = view.getInt32(state.offset, false); state.offset += 4
      names.set((r + g * 256 + b * 65536 + a * 16777216) >>> 0, name)
    }
  }
  return { values, names }
}

async function fetchBuffer(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not load ${url}`)
  return response.arrayBuffer()
}

function readDwiPreview(buffer: ArrayBuffer) {
  const view = new DataView(buffer)
  const magic = new TextDecoder().decode(new Uint8Array(buffer, 0, 4))
  if (magic !== 'DWIP') throw new Error('Invalid DWI preview')
  let offset = 4
  const lineCount = view.getUint32(offset, true); offset += 4
  const positions: number[] = []
  const colors: number[] = []
  for (let line = 0; line < lineCount; line++) {
    const pointCount = view.getUint32(offset, true); offset += 4
    let previous: THREE.Vector3 | null = null
    for (let point = 0; point < pointCount; point++) {
      const current = new THREE.Vector3(
        view.getFloat32(offset, true),
        view.getFloat32(offset + 4, true),
        view.getFloat32(offset + 8, true),
      )
      offset += 12
      if (previous) {
        positions.push(previous.x, previous.y, previous.z, current.x, current.y, current.z)
        const direction = current.clone().sub(previous).normalize()
        const color = [Math.abs(direction.x), Math.abs(direction.y), Math.abs(direction.z)]
        colors.push(...color, ...color)
      }
      previous = current
    }
  }
  return { positions: new Float32Array(positions), colors: new Float32Array(colors), lineCount }
}

export default function BrainScene({ dataMode, viewMode, autoRotate, onSelect, onLoading }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const modeRef = useRef(viewMode)
  const dataModeRef = useRef(dataMode)
  const rotateRef = useRef(autoRotate)
  const callbackRef = useRef(onSelect)
  const [failed, setFailed] = useState(false)

  useEffect(() => { modeRef.current = viewMode }, [viewMode])
  useEffect(() => { dataModeRef.current = dataMode; if (dataMode === 'dwi') callbackRef.current(null) }, [dataMode])
  useEffect(() => { rotateRef.current = autoRotate }, [autoRotate])
  useEffect(() => { callbackRef.current = onSelect }, [onSelect])

  useEffect(() => {
    const host = mountRef.current
    if (!host) return
    let disposed = false
    let frame = 0
    let meshes: BrainMesh[] = []
    let tractLines: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial> | null = null
    let current: { mesh: BrainMesh; code: number } | null = null
    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x07100f, 0.0025)
    const camera = new THREE.PerspectiveCamera(34, host.clientWidth / host.clientHeight, 0.1, 1000)
    camera.position.set(0, 18, 255)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(host.clientWidth, host.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    host.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.enablePan = false
    controls.minDistance = 165
    controls.maxDistance = 360
    controls.rotateSpeed = 0.45
    controls.target.set(0, 0, 0)

    scene.add(new THREE.HemisphereLight(0xb5fff1, 0x07100f, 2.25))
    const key = new THREE.DirectionalLight(0xd8fff7, 3.8); key.position.set(-90, 90, 150); scene.add(key)
    const rim = new THREE.DirectionalLight(0x2af5c5, 3.2); rim.position.set(100, 15, -110); scene.add(rim)

    const group = new THREE.Group()
    group.rotation.set(-0.08, -0.34, 0)
    scene.add(group)
    const tractGroup = new THREE.Group()
    tractGroup.rotation.copy(group.rotation)
    scene.add(tractGroup)

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2(9, 9)
    let pointerActive = false
    let lastHover = 0

    const restore = () => {
      if (!current) return
      const colorAttr = current.mesh.geometry.getAttribute('color') as THREE.BufferAttribute
      const colors = colorAttr.array as Float32Array
      const { annot, baseColors } = current.mesh.userData
      for (let i = 0; i < annot.values.length; i++) {
        if (annot.values[i] === current.code) {
          colors[i * 3] = baseColors[i * 3]
          colors[i * 3 + 1] = baseColors[i * 3 + 1]
          colors[i * 3 + 2] = baseColors[i * 3 + 2]
        }
      }
      colorAttr.needsUpdate = true
      current = null
    }

    const highlight = (mesh: BrainMesh, code: number) => {
      if (current?.mesh === mesh && current.code === code) return
      restore()
      const colorAttr = mesh.geometry.getAttribute('color') as THREE.BufferAttribute
      const colors = colorAttr.array as Float32Array
      for (let i = 0; i < mesh.userData.annot.values.length; i++) {
        if (mesh.userData.annot.values[i] === code) {
          colors[i * 3] = 0.68; colors[i * 3 + 1] = 1; colors[i * 3 + 2] = 0.83
        }
      }
      colorAttr.needsUpdate = true
      current = { mesh, code }
    }

    const pick = () => {
      if (dataModeRef.current !== 'anatomy') return
      if (!pointerActive || !meshes.length) return
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObjects(meshes.filter(mesh => mesh.visible), false)[0]
      if (!hit || hit.faceIndex == null) {
        restore(); callbackRef.current(null); return
      }
      const mesh = hit.object as BrainMesh
      const index = mesh.geometry.index
      if (!index) return
      const vertex = index.getX(hit.faceIndex * 3)
      const code = mesh.userData.annot.values[vertex]
      const keyName = mesh.userData.annot.names.get(code)
      if (!keyName || keyName === 'unknown' || keyName === 'corpuscallosum') return
      const stats = corticalStatsByKey.get(`${mesh.userData.hemi}:${keyName}`)
      if (!stats) return
      highlight(mesh, code)
      const projected = hit.point.clone().project(camera)
      callbackRef.current({
        ...stats, code,
        screen: { x: (projected.x * .5 + .5) * host.clientWidth, y: (-projected.y * .5 + .5) * host.clientHeight },
      })
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      pointerActive = true
      const now = performance.now()
      if (now - lastHover > 32) { lastHover = now; pick() }
    }
    const onPointerLeave = () => { pointerActive = false }
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerleave', onPointerLeave)

    const onResize = () => {
      camera.aspect = host.clientWidth / host.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(host.clientWidth, host.clientHeight)
    }
    const resizeObserver = new ResizeObserver(onResize); resizeObserver.observe(host)

    Promise.all([
      fetchBuffer(assetUrls.lhSurface), fetchBuffer(assetUrls.lhAnnot),
      fetchBuffer(assetUrls.rhSurface), fetchBuffer(assetUrls.rhAnnot),
      fetchBuffer(assetUrls.dwiPreview),
    ]).then(([lhSurface, lhAnnot, rhSurface, rhAnnot, dwiPreview]) => {
      if (disposed) return
      const buildMesh = (surfaceData: ArrayBuffer, annotData: ArrayBuffer, hemi: Hemisphere) => {
        const surface = readSurface(surfaceData)
        const annot = readAnnotation(annotData)
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(surface.positions, 3))
        geometry.setIndex(new THREE.BufferAttribute(surface.indices, 1))
        geometry.computeVertexNormals()
        const colors = new Float32Array(annot.values.length * 3)
        for (let i = 0; i < annot.values.length; i++) {
          const name = annot.names.get(annot.values[i]) ?? 'unknown'
          const color = name === 'unknown' ? new THREE.Color('#263e3a') : hashColor(`${hemi}-${name}`)
          colors[i * 3] = color.r * .72; colors[i * 3 + 1] = color.g * .72; colors[i * 3 + 2] = color.b * .72
        }
        const baseColors = colors.slice()
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        const material = new THREE.MeshPhysicalMaterial({
          vertexColors: true, roughness: .72, metalness: .08, clearcoat: .18,
          clearcoatRoughness: .8, side: THREE.FrontSide,
        })
        const mesh = new THREE.Mesh(geometry, material) as BrainMesh
        mesh.userData = { hemi, annot, baseColors }
        group.add(mesh); meshes.push(mesh)
      }
      buildMesh(lhSurface, lhAnnot, 'lh')
      buildMesh(rhSurface, rhAnnot, 'rh')
      const bounds = new THREE.Box3().setFromObject(group)
      const center = bounds.getCenter(new THREE.Vector3())
      group.position.sub(center)
      const tracts = readDwiPreview(dwiPreview)
      const tractGeometry = new THREE.BufferGeometry()
      tractGeometry.setAttribute('position', new THREE.BufferAttribute(tracts.positions, 3))
      tractGeometry.setAttribute('color', new THREE.BufferAttribute(tracts.colors, 3))
      tractGeometry.computeBoundingBox()
      const tractCenter = tractGeometry.boundingBox!.getCenter(new THREE.Vector3())
      tractGeometry.translate(-tractCenter.x, -tractCenter.y, -tractCenter.z)
      const tractMaterial = new THREE.LineBasicMaterial({
        vertexColors: true, transparent: true, opacity: .36,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
      tractLines = new THREE.LineSegments(tractGeometry, tractMaterial)
      tractGroup.add(tractLines)
      onLoading(false)
    }).catch(() => { setFailed(true); onLoading(false) })

    const animate = () => {
      frame = requestAnimationFrame(animate)
      controls.autoRotate = rotateRef.current && !pointerActive
      controls.autoRotateSpeed = .46
      controls.update()
      group.visible = dataModeRef.current === 'anatomy'
      tractGroup.visible = dataModeRef.current === 'dwi'
      meshes.forEach(mesh => {
        const visible = modeRef.current === 'both' || modeRef.current === mesh.userData.hemi
        mesh.visible = visible
      })
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave)
      controls.dispose()
      meshes.forEach(mesh => { mesh.geometry.dispose(); mesh.material.dispose() })
      tractLines?.geometry.dispose(); tractLines?.material.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return <div className="brain-canvas" ref={mountRef}>{failed && <div className="load-error">The cortical surface could not be loaded.</div>}</div>
}
