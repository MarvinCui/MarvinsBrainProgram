# Marvin's Brain

An interactive, open-source self portrait built from personal neuroimaging and cognitive data.

The cortical surface is rendered directly from FreeSurfer `lh.pial` / `rh.pial` meshes. Hover selection uses the corresponding Desikan–Killiany `aparc.annot` labels, and measurements are read from the original `aparc.stats` files. A second DWI mode visualizes a browser-optimized subset of the full 50,000-streamline MRtrix tractogram.

The cognition section presents English translations before the Chinese source documents. The download section exposes processed MRI, segmentation, surface, tractography, and statistics files in their native research formats.

## Local development

```bash
npm install
npm run dev
```

## GitHub Pages

Push to `main`, then select **GitHub Actions** as the Pages source in the repository settings. The included workflow builds and deploys the static site.

## Data note

The included neuroimaging and cognitive documents are personal records shared by the project owner. They are not medical advice or a normative reference.
