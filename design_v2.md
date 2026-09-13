# BearDrive Formosa — Design System V2 & Brandkit Specification

> **Official Design System & Visual Identity Manual**  
> *Formosa, Argentina • "Compartiendo Destinos" • "Tu ciudad, tu camino"*

---

## 1. Brand Identity & Visual Architecture

### 1.1 Brand Positioning
**BearDrive** is the premier on-demand urban mobility platform in Formosa, Argentina. The brand identity radiates warmth, local pride, technological reliability, and professional elegance.

### 1.2 The 4 Official Brand Mascot Poses (3D Character Gallery)
The BearDrive mascot is a friendly, stylized 3D teddy bear wearing a golden-yellow polo shirt and a black structured cap with an embossed golden bear insignia.

| Pose Name | Visual Gesture | Primary Use Cases | Emotional Tone |
|---|---|---|---|
| **1. Bienvenida** | Waving right paw, cheerful smile, warm gaze | Splash Screen, Sign-In (`Pantalla de Ingreso`), Welcome Onboarding, Guest Mode banner | Hospitable, accessible, inviting |
| **2. En Movimiento** | Dynamic walking/running forward with purpose | Active Ride In-Progress, Driver Radar Scanning, Finding Driver match state | Energetic, punctual, active |
| **3. Aprobado** | Right paw giving an enthusiastic thumbs-up | Ride Completed, Payment Success, KYC Verification Approved, 5-Star Rating feedback | Reassuring, accomplished, trusted |
| **4. De Pie** | Symmetrical upright standing posture, hands at sides | User Profile, Help & Support center, Driver Terms & Vehicle Selection | Solid, authoritative, dependable |

---

## 2. Color System Palette (Tokens & CSS Variables)

```
                     BEARDRIVE FORMOSA COLOR MATRIX
┌──────────────────────────────────────────────────────────────────────────┐
│  PRIMARY BRAND ACCENTS                                                  │
│  [ Golden Amber #E9B74E ] ───────► [ Sunset Orange #F28E2B ]             │
├──────────────────────────────────────────────────────────────────────────┤
│  DARK CANVAS & TONAL GLASS                                              │
│  [ Deep Obsidian #0E1320 ] ──► [ Surface Navy #181E2F ] ──► [ Indigo #232D48 ]
├──────────────────────────────────────────────────────────────────────────┤
│  FUNCTIONAL STATUS                                                      │
│  Success: #10B981 │ Alert: #EF4444 │ Warning: #F59E0B │ Info: #3B82F6    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Color Tokens Table

| Token Name | HEX Value | RGB | Semantic Role & Hierarchy |
|---|---|---|---|
| **`color-primary-gold`** | `#E9B74E` | `rgb(233, 183, 78)` | Primary brand accent, primary CTA background, active navigation indicator dot, golden badge rings |
| **`color-sunset-orange`** | `#F28E2B` | `rgb(242, 142, 43)` | Secondary brand accent, gradient transition endpoint, vehicle type highlight, surge indicator |
| **`color-deep-navy`** | `#0E1320` | `rgb(14, 19, 32)` | Canvas root background (dark theme), OLED power-saving map base |
| **`color-surface-navy`** | `#181E2F` | `rgb(24, 30, 47)` | Elevated cards, bottom sheet drawers, modals, side menu panels |
| **`color-accent-indigo`** | `#232D48` | `rgb(35, 45, 72)` | Card borders, subtle dividers, inactive pill backdrops, input borders |
| **`color-pure-white`** | `#FFFFFF` | `rgb(255, 255, 255)` | Primary titles, hero headlines, high-contrast labels, active icons |
| **`color-muted-slate`** | `#8B93A8` | `rgb(139, 147, 168)` | Subtitles, input placeholders, distance/time metadata, inactive tabs |
| **`color-success-emerald`** | `#10B981` | `rgb(16, 185, 129)` | Driver Online indicator, confirmed ride badge, payment verified |
| **`color-alert-crimson`** | `#EF4444` | `rgb(239, 68, 68)` | Trip cancellation, critical debt blocker, SOS emergency button |
| **`color-warning-amber`** | `#F59E0B` | `rgb(245, 158, 11)` | High-demand surge multiplier, pending documentation review |
| **`color-info-blue`** | `#3B82F6` | `rgb(59, 130, 246)` | Maneuver navigation banners, turn-by-turn guidance, GPS tips |
| **`color-promo-violet`** | `#8B5CF6` | `rgb(139, 92, 246)` | Auth CTA sunset-to-violet gradient, loyalty rewards, promo codes |

### 2.2 Official Gradient Definitions

```css
/* Primary Warm Sunset CTA Gradient */
--gradient-bear-gold: linear-gradient(135deg, #E9B74E 0%, #F28E2B 100%);

/* Auth Screen Hero Gradient (from media_1789261057892.png) */
--gradient-auth-cta: linear-gradient(135deg, #F28E2B 0%, #E9B74E 40%, #8B5CF6 100%);

/* Background Radial Glow (Formosa Sunset Costanera) */
--gradient-costanera-glow: radial-gradient(circle at 50% 30%, rgba(242, 142, 43, 0.18) 0%, rgba(14, 19, 32, 0) 70%);

/* Glass Surface Tint */
--glass-surface: rgba(24, 30, 47, 0.85);
--glass-border: rgba(255, 255, 255, 0.08);
--glass-border-focus: rgba(233, 183, 78, 0.45);
```

---

## 3. Typography Hierarchy

The type system pairs the geometric, tech-forward **Space Grotesk** for display titles, logos, and badges with the highly readable **Inter** / **DM Sans** for conversational text and forms, and tabular **JetBrains Mono** for numerical accuracy.

```
BEARDRIVE TYPOGRAPHIC SCALE
├── Display XL (32-36px Space Grotesk Bold) ─────► "Compartiendo destinos."
├── Headline Lg (22-26px Space Grotesk SemiBold) ──► "Solicitá tu viaje sin rodeos."
├── Title Md (18-20px Inter SemiBold) ───────────► "Detalles del viaje"
├── Body Reg (14-15px Inter Regular) ────────────► "Tu conductor llegará en aproximadamente 3 minutos."
├── Caption (12-13px Inter Medium) ──────────────► "Patente: AB 123 CD • Toyota Etios"
└── Tabular Mono (14-22px JetBrains Mono) ───────► PIN: 4 8 2 1 | $3.500 ARS
```

### 3.1 Type Specifications

| Scale Role | Font Family | Size / Line Height | Weight | Tracking | Purpose |
|---|---|---|---|---|---|
| **Display-Hero** | `Space Grotesk` | 32px / 1.15 | Bold (700) | -0.02em | Splash slogans, selection screen title |
| **Headline-Lg** | `Space Grotesk` | 24px / 1.25 | Bold (700) | -0.01em | Modal headers, screen primary titles |
| **Title-Md** | `Inter` | 18px / 1.30 | SemiBold (600) | normal | Card titles ("Solicitar Viaje", "Comenzar Turno") |
| **Body-Lg** | `Inter` | 16px / 1.50 | Regular (400) | normal | Prominent form inputs, user greeting |
| **Body-Md** | `Inter` | 14px / 1.45 | Regular (400) | normal | Standard body text, descriptions, chat messages |
| **Label-Caps** | `Space Grotesk` | 11px / 1.00 | Bold (700) | +0.08em | Status badges, category tags, service chips |
| **Data-Mono** | `JetBrains Mono` | 14px / 1.00 | Medium (500) | +0.04em | License plates, ETA countdowns, price tags |
| **PIN-Display** | `JetBrains Mono` | 24px / 1.00 | Bold (700) | +0.25em | 4-digit security trip validation PIN |

---

## 4. Button Component System

### 4.1 Primary Button ("Pill Gold Gradient")
- **Geometry**: Height 52px, `rounded-full` (border-radius 9999px), full-width on mobile.
- **Background**: `linear-gradient(135deg, #E9B74E 0%, #F28E2B 100%)`.
- **Typography**: `Space Grotesk` Bold (700), 15px, color `#0E1320` (Dark Obsidian).
- **Shadow**: `0 10px 25px -5px rgba(233, 183, 78, 0.35)`.
- **States**:
  - *Hover/Active*: `transform: scale(0.98)`, brightness 1.05.
  - *Disabled*: `opacity: 0.45; filter: grayscale(40%); pointer-events: none;`.

### 4.2 Auth Primary Button ("Pill Sunset-Violet")
*Directly specified from the Pantalla de Ingreso reference (`media_1789261057892.png`):*
- **Geometry**: Height 52px, `rounded-full`.
- **Background**: `linear-gradient(90deg, #F28E2B 0%, #E9B74E 35%, #8B5CF6 100%)`.
- **Typography**: `Space Grotesk` Extrabold (800), 16px, uppercase, letter-spacing +0.05em, color `#FFFFFF`.
- **Shadow**: `0 12px 28px -6px rgba(139, 92, 246, 0.4)`.

### 4.3 Secondary / Outline Button
- **Geometry**: Height 48px, `rounded-full`.
- **Background**: Surface Navy `rgba(24, 30, 47, 0.9)`.
- **Border**: `1px solid rgba(255, 255, 255, 0.12)`.
- **Typography**: `Inter` SemiBold (600), 14px, color `#FFFFFF`.
- **Hover**: Border `#E9B74E`, text `#E9B74E`.

### 4.4 Floating Action Buttons (FAB / Cockpit Controls)
- **Geometry**: Circular 44px × 44px or 48px × 48px.
- **Glass Formula**: `background: rgba(24, 30, 47, 0.92); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.12)`.
- **Icon**: 20px, color `#E9B74E`.
- **Active Transition**: `active:scale-95 duration-150`.

---

## 5. Input Fields & Form Controls

### 5.1 Standard Form Field
- **Height**: 52px.
- **Radius**: `14px` (smooth squircle).
- **Background**: `#181E2F` (translucent Navy `rgba(24, 30, 47, 0.75)`).
- **Border**: `1px solid #232D48`.
- **Text**: 15px `Inter`, color `#FFFFFF`, placeholder `#8B93A8`.
- **Focus State**: Border color `#E9B74E`, glow `box-shadow: 0 0 0 3px rgba(233, 183, 78, 0.25)`.
- **Error State**: Border color `#EF4444`, glow `box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.25)`.

### 5.2 Social Auth Buttons
- Dual side-by-side pills (`Google` with 4-color G icon, `Apple` with white Apple icon).
- Glass container with 1px border `rgba(255, 255, 255, 0.1)`.

### 5.3 4-Digit Discrete PIN Input
- 4 discrete squircle boxes (56px width × 64px height).
- Monospace font (`JetBrains Mono`), 28px bold, centered.
- Auto-focus advance to the next digit.

---

## 6. Core UI Card Components & Glassmorphism Spec

### 6.1 Glassmorphic Recipe (Tonal Depth)
```css
.glass-card-v2 {
  background: rgba(24, 30, 47, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5);
}
```

### 6.2 Selection Screen Hero Cards (`Pantalla de Selección`)
*Directly specified from mockup `media_1789261019338.png`:*

1. **Card "Solicitar Viaje" (Passenger Flow)**
   - Left Icon: User silhouette inside an Amber squircle container (`bg-[#E9B74E]/15`, icon `#E9B74E`).
   - Title: **Solicitar Viaje** (17px `Space Grotesk` Bold, `#FFFFFF`).
   - Subtitle: *Reserva tu trayecto con estilo* (13px `Inter` Medium, `#8B93A8`).
   - Right Action: Circular border icon with chevron arrow (`#E9B74E`).

2. **Card "Comenzar Turno" (Driver Flow)**
   - Left Icon: Car silhouette inside an Emerald squircle container (`bg-[#10B981]/15`, icon `#10B981`).
   - Title: **Comenzar Turno** (17px `Space Grotesk` Bold, `#FFFFFF`).
   - Subtitle: *Maximiza tus ingresos al volante* (13px `Inter` Medium, `#8B93A8`).
   - Right Action: Circular border icon with chevron arrow (`#10B981`).

### 6.3 Service Tier Chips (Passenger Booking)
- **Bear Clásico**: Standard local hatchback / sedan.
- **Bear Plus**: Spacious sedan with premium A/C.
- **Bear Premium**: High-end SUV / Executive sedan with top-rated driver.
- Style: Horizontal scrollable pills with 1px border, vehicle icon, price badge, and active gold ring.

---

## 7. Floating Capsule Navigation System

### 7.1 Bottom Capsule Dock
*Directly specified from mockups `media_1789261019338.png` and `media_1789260140675.png`:*
- **Floating Position**: Fixed at bottom, floating `16px` above the home indicator (`bottom-[calc(env(safe-area-inset-bottom)+1rem)]`).
- **Geometry**: Height 64px, width `calc(100% - 32px)`, max-width 420px, `rounded-full` (32px capsule).
- **Surface**: `background: rgba(24, 30, 47, 0.92); backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.12)`.
- **4 Primary Destinations**:
  1. `Home / Inicio` (House outline icon)
  2. `Actividad / Viajes` (Clock / receipt icon)
  3. `Conducir / Auto` (Car outline icon)
  4. `Perfil / Ajustes` (User gear icon)
- **Active State Indicator**: Active icon glows `#E9B74E`, with a subtle 4px golden dot centered directly underneath the icon.

### 7.2 Top Search Capsule
- Floating 12px below status bar.
- Rounded pill with search magnifying glass, "A dónde vas?" placeholder, and quick-filter button on the right.

---

## 8. Driver Cockpit & Navigation Experience (HUD)

### 8.1 Zero-Distortion MapView Architecture
- **Problem Solved**: Previous 3D perspective (`perspective(1000px) rotateX(48deg)`) squished the map into a floating 9:16 card on mobile.
- **V2 Solution**: Pure 2D heading rotation (`rotate(${-safeHeading}deg)`).
- **Container Sizing**: Square container `180vmax × 180vmax` centered at `50%, 50%` with `transformOrigin: "center center"`.
  - At any rotation angle (0° to 360°), every pixel of any screen aspect ratio (9:16, 16:9, tablet) is 100% covered.
  - Zero black borders, zero perspective distortion, smooth 60fps rotation as the vehicle travels.

### 8.2 Concentric Radar Rings HUD (15 km Scanning)
- Concentric pulsing rings in Golden Amber (`#E9B74E` at 10%, 20%, 30% opacity).
- Center pulsating radar beacon icon with active ping animation.
- Real-time Screen Wake Lock active badge (`#10B981` Emerald "Pantalla activa").

### 8.3 Floating "Recentrar mi ubicación" Button
- Position: Floating on the lower right (`right-3.5 bottom-36`).
- Behavior: Tapping triggers immediate Google Maps `panTo(driverPos)` and resets zoom to 16.

### 8.4 Turn-by-Turn Maneuver Drawer (Top HUD)
- Distance to next turn in large bold figures (`"En 250 m"`).
- Dynamic arrow maneuver icon (Turn left, Turn right, Roundabout, Keep straight).
- Current street name and destination arrival ETA (`"14:35 • 8 min • 2,4 km"`).
- Dynamic recalculation as the vehicle advances along route steps.

### 8.5 Acoustic Request Alert & 15s Radial Countdown
- Dual-chime native Web Audio synthesizer (587 Hz + 880 Hz harmonic bell) every 2.4s.
- Circular SVG progress ring that depletes smoothly from 15s down to 0s.
- Single-tap "Aceptar Viaje" primary golden pill button.

---

## 9. Tailwind CSS Configuration Reference (Design Tokens)

```javascript
// tailwind.config.js extension snippet for BearDrive V2
module.exports = {
  theme: {
    extend: {
      colors: {
        bear: {
          gold: "#E9B74E",
          orange: "#F28E2B",
          canvas: "#0E1320",
          surface: "#181E2F",
          indigo: "#232D48",
          muted: "#8B93A8",
          emerald: "#10B981",
          crimson: "#EF4444",
          violet: "#8B5CF6",
        },
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        squircle: "14px",
        dock: "32px",
      },
      boxShadow: {
        goldGlow: "0 10px 25px -5px rgba(233, 183, 78, 0.35)",
        dockGlass: "0 20px 40px -15px rgba(0, 0, 0, 0.6)",
      },
    },
  },
};
```
