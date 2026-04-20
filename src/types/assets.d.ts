// Static asset module declarations.
// Vite resolves these imports at build time to URLs (or inlined data URIs);
// this file teaches TypeScript what the imported value's type looks like.

declare module '*.svg' {
  const src: string
  export default src
}

declare module '*.png' {
  const src: string
  export default src
}

declare module '*.jpg' {
  const src: string
  export default src
}

declare module '*.jpeg' {
  const src: string
  export default src
}

declare module '*.webp' {
  const src: string
  export default src
}
