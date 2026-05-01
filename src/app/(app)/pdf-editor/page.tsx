'use client'

import dynamic from 'next/dynamic'

const PDFEditorSection = dynamic(
  () => import('@/components/sections/pdf-editor-section').then(mod => ({ default: mod.PDFEditorSection })),
  { ssr: false, loading: () => <div className="p-8 text-center text-muted-foreground">Loading PDF Editor...</div> }
)

export default function PDFEditorPage() {
  return <PDFEditorSection />
}
