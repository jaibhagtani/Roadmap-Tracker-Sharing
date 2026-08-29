import './globals.css'; import { ThemeProvider } from '@/components/theme-provider'; import { ReduxProvider } from '@/lib/redux/provider';
export const metadata={title:'Roadmap — Learning OS',description:'Personal learning roadmap and progress tracker'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html suppressHydrationWarning><body><ReduxProvider><ThemeProvider>{children}</ThemeProvider></ReduxProvider></body></html>}
