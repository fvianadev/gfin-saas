---
name: Emerald Grooming System
colors:
  surface: '#051424'
  surface-dim: '#051424'
  surface-bright: '#2c3a4c'
  surface-container-lowest: '#010f1f'
  surface-container-low: '#0d1c2d'
  surface-container: '#122131'
  surface-container-high: '#1c2b3c'
  surface-container-highest: '#273647'
  on-surface: '#d4e4fa'
  on-surface-variant: '#bdcabc'
  inverse-surface: '#d4e4fa'
  inverse-on-surface: '#233143'
  outline: '#879487'
  outline-variant: '#3e4a3f'
  surface-tint: '#66dd8b'
  primary: '#6ee591'
  on-primary: '#003919'
  primary-container: '#50c878'
  on-primary-container: '#005025'
  inverse-primary: '#006d36'
  secondary: '#bec6df'
  on-secondary: '#283044'
  secondary-container: '#41495e'
  on-secondary-container: '#b0b8d1'
  tertiary: '#c9cddc'
  on-tertiary: '#2b303b'
  tertiary-container: '#aeb2c0'
  on-tertiary-container: '#404450'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#83fba5'
  primary-fixed-dim: '#66dd8b'
  on-primary-fixed: '#00210c'
  on-primary-fixed-variant: '#005227'
  secondary-fixed: '#dae2fc'
  secondary-fixed-dim: '#bec6df'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465b'
  tertiary-fixed: '#dee2f1'
  tertiary-fixed-dim: '#c2c6d4'
  on-tertiary-fixed: '#171c26'
  on-tertiary-fixed-variant: '#424752'
  background: '#051424'
  on-background: '#d4e4fa'
  surface-variant: '#273647'
typography:
  headline-lg:
    fontFamily: Montserrat
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Montserrat
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: 0.01em
  headline-sm:
    fontFamily: Montserrat
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-margin: 2rem
  gutter: 1.5rem
  section-gap: 3rem
  component-padding: 1rem
---

## Brand & Style

This design system embodies a premium, "after-hours" lounge aesthetic tailored for high-end barber shops and salons. The brand personality is professional, sleek, and masculine, evoking an atmosphere of exclusive craftsmanship. 

The visual style is a blend of **Corporate Modern** and **Glassmorphism**. It utilizes a deep, nocturnal color palette that allows the primary emerald accent to radiate. High-contrast elements are balanced by soft, elevated surfaces and subtle translucency, ensuring the interface feels luxurious rather than heavy.

## Colors

The palette is anchored by a vibrant Emerald Green, used strategically for primary actions and success states to create a clear focal point against the dark canvas.

- **Primary:** Emerald (#50C878) — used for the main calls to action, active states, and highlights.
- **Secondary (Surface):** Deep Navy (#1A2235) — used for cards, modals, and input fields to provide subtle separation from the background.
- **Tertiary (Background):** Midnight Blue (#0F141E) — the foundation color for the entire application.
- **Neutral:** Slate Gray (#94A3B8) — utilized for secondary text, labels, and icons to maintain hierarchy without competing with the emerald accent.

## Typography

The system utilizes **Montserrat** for headlines to convey strength and authority through its geometric, bold forms. For body copy and interactive labels, **Plus Jakarta Sans** is employed to offer a modern, friendly, yet professional reading experience.

A strong emphasis is placed on "All-Caps" styling for labels and primary buttons to reinforce the structured, editorial feel of the brand. Hierarchy is established through weight and color (Emerald for titles, Slate for secondary labels) rather than just size.

## Layout & Spacing

The design system uses a **Fluid Grid** model with a 12-column structure for desktop, transitioning to 4 columns for mobile. 

The spacing rhythm is built on an 8px base unit. Content containers utilize generous internal padding (24px - 32px) to ensure the dark theme feels airy and expansive. Modals and cards are centered with significant backdrop margins to emphasize their elevated position in the stack.

## Elevation & Depth

Visual hierarchy is achieved through **Tonal Layers** combined with subtle **Glassmorphism**. 

- **Level 0 (Background):** The deepest midnight blue, matte finish.
- **Level 1 (Cards/Inputs):** Deep navy with a 1px stroke (opacity 10%) to define edges.
- **Level 2 (Modals):** Slight backdrop blur (8px-12px) with a subtle top-down gradient and a soft ambient shadow (0px 20px 50px rgba(0,0,0, 0.5)).
- **Level 3 (Primary Buttons):** High-saturation emerald with a matching outer glow (0px 4px 15px rgba(80, 200, 120, 0.3)) to simulate a light-emitting surface.

## Shapes

The shape language is consistently **Rounded**, using a radius of 16px (1rem) for major containers like modals and 8px (0.5rem) for smaller elements like inputs and buttons. This softening of the geometric layout creates a premium, modern feel that contrasts effectively with the sharp, bold typography.

## Components

### Buttons
- **Primary:** Solid Emerald background, white or dark-navy text (heavy weight). Includes a subtle glow on hover.
- **Secondary/Ghost:** Deep navy background with a 1px border or fully transparent with bold white text. Use for "Cancel" or "Back" actions.

### Input Fields
- **Container:** Darker than the card background to create a "recessed" look. 
- **Borders:** Subtle 1px stroke in a slightly lighter navy. On focus, the border transitions to Emerald.
- **Labels:** Positioned above the field in uppercase bold typography, using the Neutral color.

### Cards & Modals
- High corner radius (16px).
- Internal dividers should be subtle (1px line with 10% white opacity).
- Headers in modals use the Emerald primary color to immediately orient the user.

### Icons
- **Style:** Linear, minimalist, 2px stroke width.
- **Color:** Defaults to Neutral (Slate), switching to Emerald for active or successful states.