import type { Config } from 'tailwindcss';
export default { darkMode:'class', content:['./app/**/*.{ts,tsx}','./components/**/*.{ts,tsx}'], theme:{extend:{colors:{bg:'hsl(var(--bg))',card:'hsl(var(--card))',muted:'hsl(var(--muted))',line:'hsl(var(--line))',accent:'hsl(var(--accent))'}}}, plugins:[] } satisfies Config;
