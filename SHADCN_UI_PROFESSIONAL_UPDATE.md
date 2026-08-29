# Professional UI / shadcn-style update

Implemented a cohesive shadcn-inspired design system across the application without adding a runtime UI dependency layer.

## Included
- shadcn-compatible `components.json` configuration using the New York style.
- Reusable Button, Card, Badge, Input and Separator primitives under `components/ui/`.
- CSS-variable design tokens for light/dark themes.
- Refined typography, surfaces, borders, focus states, shadows and spacing.
- Premium glass navigation chrome and consistent application shell treatment.
- Improved authentication shell with enterprise-style visual hierarchy.
- Existing roadmap editor visuals and behavior preserved.
- Existing pages continue to import the compatibility exports from `components/ui.tsx`.

## Validation
- Project source was inspected after the UI changes.
- Full typecheck/build could not be completed in this environment because project dependencies are not installed and npm dependency installation timed out.
