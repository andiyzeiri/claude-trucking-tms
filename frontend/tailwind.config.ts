import type { Config } from "tailwindcss"

const config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        groupWeek: "#caf0f8",
        groupDriver: "#f3d5b5",

        // ------------------------------------------------------------------
        // Monday-style design tokens, exposed to Tailwind.
        //
        // These point at the CSS variables already defined in globals.css -
        // no new colours are introduced here. Editing a --monday-* value in
        // globals.css still drives both these classes and every existing
        // inline style={{ }}, so the two approaches stay in sync.
        //
        // Names are deliberately NOT 'muted', 'border', 'background' etc:
        // those keys are already taken by shadcn above, and overwriting them
        // would silently restyle every shadcn component (tabs.tsx uses
        // bg-muted / text-muted-foreground, for instance).
        //
        //   bg-surface  bg-surface-subtle  bg-surface-hover
        //   text-content  text-content-secondary  text-content-muted
        //   border-line  border-line-light
        //   text-brand  bg-brand  text-brand-blue  text-brand-purple
        //   text-status-done  text-status-stuck  text-status-working
        // ------------------------------------------------------------------
        surface: {
          DEFAULT: "var(--monday-bg-primary)",
          subtle: "var(--monday-bg-secondary)",
          hover: "var(--monday-bg-hover)",
        },
        content: {
          DEFAULT: "var(--monday-text-primary)",
          secondary: "var(--monday-text-secondary)",
          muted: "var(--monday-text-muted)",
        },
        line: {
          DEFAULT: "var(--monday-border)",
          light: "var(--monday-border-light)",
        },
        brand: {
          DEFAULT: "var(--monday-cornflower)",
          blue: "var(--monday-blue)",
          purple: "var(--monday-purple)",
          mirage: "var(--monday-mirage)",
        },
        status: {
          done: "var(--monday-done)",
          stuck: "var(--monday-stuck)",
          working: "var(--monday-working)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config