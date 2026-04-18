'use client'

import dynamic from 'next/dynamic'
import { useActiveSection } from '@/stores/active-section-store'
import { DashboardSection } from '@/components/sections/dashboard-section'
import { CalculatorsSection } from '@/components/sections/calculators-section'
import { PipelinesSection } from '@/components/sections/pipelines-section'
import { WorkflowBuilderSection } from '@/components/sections/workflow-builder-section'
import { UnitConverterSection } from '@/components/sections/unit-converter-section'
import { LearningSection } from '@/components/sections/learning-section'
import { DataAnalysisSection } from '@/components/sections/data-analysis-section'
import { LogicSimulatorSection } from '@/components/sections/logic-simulator-section'
import { ElectricalSimulatorSection } from '@/components/sections/electrical-simulator-section'
import { DiagramStudioSection } from '@/components/sections/diagram-studio-section'
import { SettingsSection } from '@/components/sections/settings-section'

// Dynamic import for PDF Editor (pdfjs-dist uses DOMMatrix which is not available in SSR)
const PDFEditorSection = dynamic(
  () => import('@/components/sections/pdf-editor-section').then(mod => ({ default: mod.PDFEditorSection })),
  { ssr: false, loading: () => <div className="p-8 text-center text-muted-foreground">Loading PDF Editor...</div> }
)

const sections = {
  dashboard: DashboardSection,
  calculators: CalculatorsSection,
  pipelines: PipelinesSection,
  workflow: WorkflowBuilderSection,
  'unit-converter': UnitConverterSection,
  learning: LearningSection,
  'data-analysis': DataAnalysisSection,
  'logic-simulator': LogicSimulatorSection,
  'pdf-editor': PDFEditorSection,
  'electrical-simulator': ElectricalSimulatorSection,
  'diagram-studio': DiagramStudioSection,
  settings: SettingsSection,
}

export default function Home() {
  const { activeSection } = useActiveSection()
  const ActiveSection = sections[activeSection] || DashboardSection

  return <ActiveSection />
}
