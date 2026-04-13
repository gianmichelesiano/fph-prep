```markdown
# Design System Documentation: The Clinical Atelier

## 1. Overview & Creative North Star
**Creative North Star: "The Clinical Atelier"**
To prepare for the Swiss pharmacy exam (FPH), a student needs more than just a database of questions; they need an environment that mirrors the precision of a laboratory and the sophisticated calm of a Swiss editorial journal. 

This design system rejects the "standard app" aesthetic of heavy borders and cluttered grids. Instead, it adopts **The Clinical Atelier**—a philosophy of high-end, academic minimalism. We achieve this through "The No-Line Rule," intentional asymmetry, and a focus on tonal depth. By utilizing breathable layouts and editorial typography, we transform a high-stress preparation process into a focused, premium ritual.

---

## 2. Colors: Tonal Architecture
The palette is rooted in medical professionalism but executed with the depth of a luxury brand.

### Core Tokens
- **Primary (`#005f6a`):** Our anchor. A deep, intellectual teal that represents the authority of the FPH.
- **Surface (`#f8f9fa`):** The "clean room" background. All layouts begin here.
- **Success (`#10B981`):** Use for passed states, but only as a functional accent.
- **Error (`#ba1a1a`):** A sophisticated medical red, used sparingly to minimize user anxiety.

### The "No-Line" Rule
Standard UI relies on 1px borders to separate content. **In this system, 1px solid borders are prohibited for sectioning.** Boundaries must be defined through:
1.  **Background Shifts:** Placing a `surface-container-low` card on a `surface` background.
2.  **Negative Space:** Using the spacing scale to create implicit boundaries.

### Surface Hierarchy & Nesting
Treat the UI as layered sheets of fine vellum. 
- **Base Layer:** `surface`
- **Secondary Content:** `surface-container-low`
- **Interactive/Floating Elements:** `surface-container-lowest` (pure white) to create a "lifted" feel.

### The "Glass & Gradient" Rule
To avoid a flat, "template" look:
- **CTAs:** Use a subtle linear gradient from `primary` (#005f6a) to `primary_container` (#007a87).
- **Overlays:** Use Glassmorphism. Apply `surface_variant` with 60% opacity and a `20px` backdrop-blur for language switchers or navigation drawers.

---

## 3. Typography: Editorial Authority
We pair two typefaces to balance Swiss geometric precision with functional legibility.

- **Display & Headlines (Manrope):** Use Manrope for all `display` and `headline` tokens. Its modern, wide apertures feel premium and academic. Use `headline-lg` for area titles (e.g., Phytotherapy) to create a striking editorial header.
- **Body & Titles (Inter):** Use Inter for all `title`, `body`, and `label` tokens. Inter is optimized for the long-form clinical case studies and complex pharmacy questions.
- **Visual Hierarchy:** Maintain a high contrast between `headline-lg` and `body-md`. The "Editorial Gap" (large spacing between a headline and the start of body text) is essential for the calm, academic feel.

---

## 4. Elevation & Depth: Tonal Layering
We do not use elevation to indicate "distance" in the traditional sense, but rather "focus."

- **The Layering Principle:** Depth is achieved by stacking. A `surface-container-lowest` card sitting on a `surface-container` background creates a natural, soft lift.
- **Ambient Shadows:** For floating elements (like a "Finish Exam" button), use extra-diffused shadows. 
    - *Formula:* `0px 12px 32px rgba(25, 28, 29, 0.05)`. 
    - The shadow color is a 5% tint of `on-surface`, never pure black.
- **The "Ghost Border" Fallback:** If a container requires a border for accessibility (e.g., an input field), use the `outline-variant` token at **20% opacity**. This provides a "ghost" of a line that guides the eye without cluttering the canvas.

---

## 5. Components: Primitive Logic

### Cards & Question Containers
- **Styling:** Forbid divider lines within cards. Use `surface-container-highest` for the question header and `surface-container-lowest` for the answer options.
- **Shadow:** No shadow by default; use tonal contrast.

### Buttons (The Signature CTA)
- **Primary:** Gradient fill (`primary` to `primary_container`), `xl` (0.75rem) roundedness.
- **Secondary:** Transparent fill with a "Ghost Border" (20% `outline-variant`).
- **Tertiary:** Text-only, using `primary` color with a subtle `label-md` weight.

### Progress Bars (Clinical Precision)
- **Track:** `surface-container-highest`.
- **Indicator:** `primary` solid. 
- **Design:** Maintain a thick (8px) height with `full` rounding to make progress feel substantial and rewarding.

### Language Switcher
- Minimalist glassmorphic capsule. Use `surface_container_low` at 80% opacity with a `backdrop-filter: blur(10px)`. No border.

### Area Theme Tags
For the 9 areas (Clinical Pharmacy, Recipe Validation, etc.):
- Use a **Low-Saturation Tint** system. Each area gets a distinct color (e.g., Phytotherapy: Sage Green), but the tag itself should be a `tertiary_container` variant to ensure it doesn't clash with the primary teal action buttons.

---

## 6. Do’s and Don’ts

### Do
- **Do** use intentional asymmetry. Align your headers to the far left while the exam question sits in a slightly narrower, centered column to create an editorial feel.
- **Do** use `surface-container` tiers to group related clinical information.
- **Do** prioritize white space. If a screen feels "busy," increase the padding rather than adding a line.

### Don’t
- **Don't** use 100% opaque borders. They create "visual noise" that increases student stress.
- **Don't** use standard "drop shadows." They feel dated and heavy. Stick to tonal layering.
- **Don't** use "Alert" colors for non-essential info. Keep the palette calm; only use `error` when a student has genuinely failed a critical step.
- **Don't** use generic icons. Use thin-stroke, medical-grade iconography that matches the weight of the Inter typeface.

---
**Director's Note:** Every pixel in this system should feel like it was placed with a pair of surgical tweezers. This is not just an exam prep tool; it is a professional partner for the next generation of Swiss pharmacists.```