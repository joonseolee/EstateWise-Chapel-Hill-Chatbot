import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en" className="bg-background">
      <Head>
        {/* Basic Meta Tags */}
        <meta charSet="utf-8" />
        <meta name="application-name" content="EstateWise" />
        <meta
          name="description"
          content="EstateWise - Your intelligent estate assistant providing personalized property recommendations in Chapel Hill."
        />
        <meta name="keywords" content="Real Estate, AI, Chapel Hill, Property Recommendations, EstateWise" />
        <meta name="author" content="Son Nguyen" />
        <meta name="robots" content="index, follow" />
        <meta name="theme-color" content="#faf9f2" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="https://estatewise.vercel.app/favicon.ico" />
        <link
          rel="manifest"
          href="https://estatewise.vercel.app/manifest.json"
        />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta
          property="og:title"
          content="EstateWise - Intelligent Estate Assistant"
        />
        <meta
          property="og:site_name"
          content="EstateWise | Your Intelligent Estate Assistant"
        />
        <meta
          property="og:description"
          content="Discover your dream property in Chapel Hill with personalized recommendations from EstateWise."
        />
        <meta property="og:url" content="https://estatewise.vercel.app/" />
        <meta
          property="og:image"
          content="https://estatewise.vercel.app/android-chrome-512x512.png"
        />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="EstateWise - Intelligent Estate Assistant"
        />
        <meta
          name="twitter:description"
          content="Discover your dream property in Chapel Hill with personalized recommendations from EstateWise."
        />
        <meta
          name="twitter:image"
          content="https://estatewise.vercel.app/android-chrome-512x512.png"
        />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
