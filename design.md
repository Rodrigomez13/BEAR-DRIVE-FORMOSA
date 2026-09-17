# BearDrive Formosa — Design Specification (Current Baseline)

## 1. Executive Summary & Brand Overview
**BearDrive Formosa** is an urban mobility and on-demand ride-hailing application tailored specifically for the city of Formosa, Argentina. The platform bridges passengers and vetted local drivers with fair pricing, transparent commission rates, and high-contrast night/day navigation modes.

### Brand Attributes
- **Name**: BearDrive
- **City / Region**: Formosa, Capital (Argentina)
- **Tagline**: *Compartiendo Destinos*
- **Aesthetic**: Night-mode first, dark cyberpunk-inspired glassmorphism with high-contrast golden amber accents.

---

## 2. Current Screen Canvas Inventory
*Documented directly from the comprehensive multi-device application board:*

| Screen Name | Viewport Size | Primary Role | Key UI Elements |
|---|---|---|---|
| **Passenger Map (Home)** | 375 × 920 | Passenger ride booking | Google Map base, top search pill, service tier chips (Clásico, Plus, Premium), estimated fare pill, payment method selector, floating location button |
| **Driver Conducir (Radar)** | 375 × 851 | Driver cockpit / dispatch | Concentric 15 km radar rings, online status switch, vehicle chip, incoming ride modal with 15s radial acoustic countdown, wake-lock indicator |
| **Driver Ganancias** | 375 × 730 | Driver earnings & wallet | Period earnings selector (Hoy, Semana, Mes), gross total, net balance, platform commission status, debt warning banner, transfer button |
| **Login / Sign In** | 375 × 724 | Authentication | Golden teddy bear mascot logo, phone / email auth, guest mode option, role switcher, primary gradient button |
| **Registro (Sign Up)** | 375 × 674 | User onboarding | Google social auth, name, email, phone with +54 9 370 prefix, password, terms and privacy acceptance |
| **Seguridad y Privacidad** | 375 × 918 | Trust & security settings | Emergency SOS button, live route sharing toggle, trusted contacts, identity verification status, biometrics |
| **Beneficios & Puntos** | 375 × 772 | Loyalty & rewards | Accumulated points pill, discount vouchers, tier progress bar (Bronce, Plata, Oro), partner business rewards |
| **Driver Onboarding** | 348 × 710 | Vehicle & license KYC | Step indicator, document photo uploads (DNI, Cédula verde, Seguro al día, RTO), review status |
| **Historial / Actividad** | 375 × 726 | Ride records | Chronological list of trips, date/time, origin-destination pins, vehicle plate, driver/passenger avatar, total fare |
| **Perfil de Usuario** | 320 × 841 | Settings & personal data | User avatar with gold badge, rating (4.9 ★), personal information, vehicle selector, balanced profile actions, logout |
| **Ayuda y Soporte** | 375 × 953 | Help desk & FAQs | Search knowledge base, topic categories (Viajes, Pagos, Conductor, Seguridad), direct WhatsApp support link |
| **Admin Dashboard** | 1440 × 914 | Operations management | Realtime active drivers, rides in the last 7 days bar chart, completion rate pie chart, active revenue metrics |
| **Admin Pricing** | 1440 × 914 | Dynamic fare configuration | Base fare, cost per km, cost per minute, vehicle multipliers, night-time & rain surge pricing controls |
| **Admin Drivers** | 1440 × 914 | Driver KYC & fleet approval | Driver verification queue, vehicle document inspect modal, approve/reject buttons, debt management |

---

## 3. Current Color System Palette

```css
:root {
  /* Canvas & Dark Surfaces */
  --bg-canvas: #0E1320;         /* Deep obsidian navy canvas */
  --bg-surface: #181E2F;        /* Elevated card & sheet background */
  --bg-surface-elevated: #232D48; /* Borders, inactive chips, hover surfaces */

  /* Primary Brand Accents */
  --accent-gold: #E9B74E;        /* BearDrive Golden Amber (CTAs & active states) */
  --accent-orange: #F28E2B;      /* Sunset Orange (Gradients & secondary badges) */
  --accent-gradient: linear-gradient(135deg, #E9B74E 0%, #F28E2B 100%);

  /* Neutrals & Text */
  --text-primary: #FFFFFF;       /* High-contrast headings and active labels */
  --text-secondary: #8B93A8;     /* Muted body text, placeholders, metadata */
  --border-subtle: rgba(255, 255, 255, 0.08); /* 1px glassmorphic card border */

  /* Functional Status */
  --status-success: #10B981;     /* Emerald green: Online, confirmed, arrived */
  --status-warning: #F59E0B;     /* Amber: Surge pricing, pending approval */
  --status-error: #EF4444;       /* Crimson: Cancellation, debt blocker */
  --status-info: #3B82F6;        /* Royal blue: Turn instructions, GPS info */
}
```

---

## 4. Current Typography Hierarchy
- **Brand & Display Headings**: `Space Grotesk`, sans-serif (Weights: Bold 700, Extrabold 800)
  - Hero Display: 28px – 32px
  - Screen Titles: 20px – 24px
- **UI Body, Inputs & Labels**: `Inter` / `DM Sans`, sans-serif (Weights: Regular 400, Medium 500, SemiBold 600)
  - Body Text: 14px – 15px
  - Helper & Metadata: 12px – 13px
  - Microcaps: 11px
- **Data, Numbers & PIN Codes**: `JetBrains Mono` / tabular numbers
  - 4-digit PIN confirmation: 24px monospace font
  - License plates: 12px uppercase monospace pill

---

## 5. Current Component Architecture

### 5.1 Button System
1. **Primary Button**: `bear-gold-gradient` (`linear-gradient(135deg, #E9B74E, #F28E2B)`), text `#0E1320` (dark navy), font-weight 700, 48px height, rounded pill (`rounded-full` or `rounded-2xl`).
2. **Secondary Ghost Button**: Surface Navy background (`#181E2F`), border `1px solid rgba(255,255,255,0.12)`, text white or golden amber.
3. **Floating Icon Button**: Circular 40px/44px, backdrop blur 12px, elevated shadow.

### 5.2 Input Controls
- Dark inputs with `#181E2F` background, border `1px solid #232D48`.
- Focus ring: `2px solid #E9B74E`.
- Built-in Argentine phone formatter (`+54 9 370 4XX-XXXX`).

### 5.3 Cards & Drawers
- Soft-rounded corners (`rounded-2xl` / `rounded-3xl` = 16px to 24px).
- Translucent backdrop blur: `backdrop-blur-md` (12px - 20px).
- 1px crisp outline: `border border-white/10`.

### 5.4 Navigation & Menus
- Bottom Navigation Bar: Floating or fixed dock at screen bottom with 4 primary destinations (Viaje, Actividad, Beneficios, Perfil).
- Top Header: Minimalist bar with logo, back chevron, and contextual status badge.

---

## 6. Map & Driver Cockpit
- **Interactive Google Maps Layer**: Custom dark theme styled for nocturnal driving.
- **2D Heading Follow Mode**: Rotates map dynamically with vehicle heading (`rotate(${-safeHeading}deg)`) inside a square `180vmax` container to prevent any aspect-ratio squeeze on 9:16 portrait displays.
- **Driver Radar HUD**: 15 km scan radius with animated pulsing golden waves.
- **Screen Wake Lock**: Prevents display timeout while the driver is online or actively on a ride.
