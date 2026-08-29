# Exact Roadmap Canvas Verification

The Create Roadmap `StudioCanvas` is the single canonical renderer for roadmap visuals.

## Canonical renderer
- `components/studio-canvas.tsx` → `StudioCanvas`
- `components/studio-canvas.tsx` → `RoadmapVisualCanvas` (read-only adapter around the same `StudioCanvas`)

## Roadmap surfaces checked
- Create Roadmap → `RoadmapEditor` → `StudioCanvas`
- Live View → `RoadmapTree` → `RoadmapVisualCanvas` → `StudioCanvas`
- Shared View → `RoadmapTree` → `RoadmapVisualCanvas` → `StudioCanvas`
- Public Share → `PublicRoadmapViewer` → `RoadmapVisualCanvas` → `StudioCanvas`
- Topic Share → `PublicRoadmapViewer` → `RoadmapVisualCanvas` → `StudioCanvas`
- Collaboration workspace → `RoadmapTree` → `RoadmapVisualCanvas` → `StudioCanvas`
- Team/community activity roadmap → `RoadmapTree` → `RoadmapVisualCanvas` → `StudioCanvas`
- Community roadmap cards link into the same shared/live renderer rather than a separate roadmap renderer.

## Exact visual state preserved
- `editorState.elements`
- `editorState.topicPositions`
- `editorState.topicColors`
- `editorState.connections`
- `editorState.viewport`
- Same topic node component and CSS
- Same element/block component and CSS
- Same curved React Flow edges
- Same grid/background
- Same handles
- Same controls and minimap
- Same default color logic, including custom hex colors

## Read-only behavior
Read-only surfaces disable canvas mutation but do not replace or restyle the roadmap renderer. The read-only badge is hidden from the canvas so the visual canvas remains identical to Create Roadmap.

## Legacy renderer audit
`components/roadmap-canvas.tsx` remains only as an unused legacy component. No application roadmap route currently imports or renders it.

## Dependency validation
A full TypeScript build cannot be completed in this environment because the uploaded project does not contain installed npm dependencies (`next`, `react`, `reactflow`, etc.). The source-level route/renderer audit was completed after the changes.
