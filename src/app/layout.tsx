import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import Nav from '@/components/Nav';
import Providers from '@/components/Providers';

const vazir = localFont({
  src: '../fonts/Vazirmatn.woff2',
  variable: '--font-vazir',
  display: 'swap',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: 'داشبورد شخصی — چارت ماهانه‌ی عملکرد',
  description: 'ثبت تسک‌های روزانه، روتین‌ها و نمودار ماهانه‌ی عملکرد',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'شنسکو',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#0d0d0d',
  width: 'device-width',
  initialScale: 1,
};

const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}else{document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();`;
const swScript = `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});});}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" data-theme="dark" className={vazir.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: swScript }} />
      </head>
      <body>
        <Providers>
          <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 pb-16 pt-6 sm:px-6">
            <Nav />
            <main className="flex-1">{children}</main>
            <footer className="pt-4 text-center text-xs" style={{ color: 'var(--muted)' }}>
              داشبورد شخصی — داده‌ها روی دستگاه خودت ذخیره می‌شن
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
