# Maddy Design Principles

Purpose: keep Maddy distinctive, fast, coherent, and human-directed as the product grows with AI-assisted implementation.

## North star
Maddy should feel like a purpose-built operations product for Maderarte, not a generic SaaS template and not a collection of polished HTML pages.

## Core principles
1. **Context before pattern.** Never choose a component because it is a common UI default. Choose it because it fits the furniture-sales workflow.
2. **Content outranks chrome.** Navigation and controls should recede; the current client, furniture, money, delivery state, and next action should dominate.
3. **No effect without a job.** Blur, glass, gradients, shadows, animation, pills, and cards require a functional reason.
4. **Cards are earned.** Do not wrap every group in a rounded card. Use cards for objects with identity/actions/state, such as one furniture line, one client, one order, one delivery.
5. **Brand lives in the content layer.** Maderarte identity should appear through furniture imagery, fabric/wood swatches, crafted typography, materials, photography, and purposeful orange accents — not by coloring every control.
6. **Orange is emphasis, not wallpaper.** Reserve the brand orange for the primary action, selection, key state, and meaningful feedback.
7. **Adaptive, not shrunken.** Desktop, tablet, and phone can share logic but should not be the same layout scaled down. Mobile prioritizes touch, progressive disclosure, docks, and sheets.
8. **Progressive disclosure.** Show the minimum needed for the current decision. Reveal optional customization, references, notes, and advanced controls only when needed.
9. **Motion explains causality.** Animation should show where something came from, where it went, or what changed. Avoid generic fade-up/reveal motion applied everywhere.
10. **Typography carries hierarchy.** Avoid title + subtitle + helper copy on every block. Prefer concise labels, strong data values, and deliberate scale contrast.
11. **One icon language.** Use a consistent stroke, optical size, and metaphor family. Avoid mixing generic icon libraries visually.
12. **State design is first-class.** Empty, loading, disabled, selected, pressed, error, success, offline, partial delivery, restored draft, and permission-limited states all need intentional design.
13. **Accessibility is visual quality.** Contrast, focus states, minimum touch targets, reduced motion, semantic structure, and readable field sizes are part of premium craft.
14. **Dense can still be calm.** Maddy is an operations tool. Prefer scannable alignment, predictable columns, and restrained hierarchy over oversized cards and excessive whitespace.
15. **Power users deserve speed.** Repeated workflows should gain keyboard shortcuts, global search, and eventually a command palette without hiding the normal UI.
16. **Maddy has a domain-specific visual language.** Furniture is not generic inventory: show model, measurements, upholstery, wood finish, photos, quantity, line total, and fulfillment state in ways that feel native to Maderarte.

## Defaults to avoid unless explicitly justified
- Purple/blue AI-style gradients or decorative glow.
- Glassmorphism on content cards.
- Large rounded cards around every section.
- Pill/eyebrow badges as decoration.
- Icon-in-colored-square repeated for every item.
- Generic three-card/bento structures where hierarchy would work better without boxes.
- Scroll fade-up animations on every block.
- Long friendly/explanatory AI microcopy when a short label is enough.
- Identical visual weight for navigation, content, secondary metadata, and primary actions.
- Desktop layouts merely compressed onto mobile.
- Multiple accent colors competing for attention.
- Unexplained shadows, borders, and nested surfaces.

## Maddy-specific interaction direction
- Desktop: quiet sidebar, contextual toolbar, calm work canvas, optional inspector for totals/details.
- Mobile: native-feeling title hierarchy, content-first scroll, floating action/summary dock, contextual bottom sheets, full-width touch targets.
- Client: search-first; once identified, collapse to a compact identity summary with Edit.
- Furniture: each item is an object card because it has identity, attributes, photos, state, actions, and value. Make these the visual center of a quote/order.
- Financial summary: persistent but subordinate until review; on mobile, access it through the bottom dock rather than a huge permanent panel.
- Technical backend language belongs in diagnostics/admin, not in the seller's primary workflow.

## Evaluation checklist
Before approving a screen, ask:
- Can a salesperson understand the next action in under 3 seconds?
- Does anything compete for attention without earning it?
- Would this screen still make sense if all shadows/gradients were removed?
- Is each card actually an object that deserves containment?
- Is the mobile composition purpose-built or just responsive?
- Does the interface visibly belong to Maderarte rather than any generic SaaS product?
- Are state, keyboard, touch, contrast, and reduced-motion behaviors intentional?
- Is there any sentence, chip, icon, border, or animation we can remove without losing meaning? If yes, remove it.

## Reference principles studied
- Nielsen Norman Group, *Good from Afar, But Far from Good: AI Prototyping in Real Design Contexts* (2025; reviewed 2026): AI outputs commonly miss hierarchy, grouping, contrast, spacing nuance and default toward indistinctive mainstream patterns.
- Nielsen Norman Group, *The Custodial Era of UX: Cleaning Up After AI* (2026): fast AI production creates UX debt when teams skip evaluation; simplify and edit generic or unnecessary output aggressively.
- Apple Human Interface Guidelines (2026): separate the control/navigation layer from content; use materials such as Liquid Glass sparingly; adapt navigation across form factors; keep color concentrated on meaningful emphasis.
- Apple WWDC26, *Communicate your brand identity on iOS*: express brand primarily in the content layer while keeping navigation familiar.
- Apple Design Awards 2026: Interaction and Visuals winners demonstrate platform-tailored controls, custom motion, accessibility, and cohesive themes.
- Google Material 3 Expressive: use scale, space, motion, type, color, and shape as intentional expressive tools while preserving usability and accessibility.
- Linear 2026 UI refresh: reduce navigation prominence, standardize headers/actions, and let the work content win attention.
- Superhuman command palette: powerful software can preserve a clean UI while giving expert users a global fast-access layer.

This document is a guardrail, not a style recipe. If a future design follows every rule but feels generic, the design is still not finished.
