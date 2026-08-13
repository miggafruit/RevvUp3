// Shared design tokens for the marketplace/e-hailing screens. The
// background/surface/text tokens match theme/authColors.ts (Welcome,
// Login), but accent is deliberately kept orange, not authColors' red —
// red as the dominant color across dozens of buttons, prices, and
// highlights read too aggressively; one red CTA on a login screen
// reads very differently than red on every primary action app-wide.
// Every key name here is unchanged from before, so every screen
// importing `colors` from this file picks up palette changes
// automatically — nothing else needs to change in those screens.

export const colors = {
  background: '#0F172A',
  surface: '#171F32',
  surfaceAlt: '#1E2A45',
  border: '#243150',
  accent: '#ff7a1a',
  accentMuted: 'rgba(255, 122, 26, 0.15)',
  textPrimary: '#FFFFFF',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  star: '#ffb020',
  danger: '#DC2626',
  success: '#73BF43',
  white: '#ffffff'
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999
};

export const typography = {
  title: { fontSize: 22, fontWeight: '800' as const },
  subtitle: { fontSize: 14, fontWeight: '500' as const },
  cardTitle: { fontSize: 15, fontWeight: '700' as const },
  cardSubtitle: { fontSize: 12.5, fontWeight: '400' as const },
  price: { fontSize: 16, fontWeight: '800' as const },
  body: { fontSize: 14, fontWeight: '400' as const }
};
