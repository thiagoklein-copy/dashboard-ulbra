import type { Metadata } from "next";
import { Roboto, Roboto_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const roboto = Roboto({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Meta Ads · ULBRA",
  description: "Dashboard interno de performance de campanhas Meta Ads",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${roboto.variable} ${robotoMono.variable} h-full antialiased`}
    >
      <head>
        {/* Aplica o tema antes da pintura — sem isso a tela pisca em claro
            antes do React hidratar. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('ulbra-tema')||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');if(t==='dark')document.documentElement.classList.add('dark');document.documentElement.style.colorScheme=t;}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
