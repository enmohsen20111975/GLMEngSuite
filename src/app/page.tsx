'use client'

import { useActiveSection } from '@/stores/active-section-store'
import { DashboardSection } from '@/components/sections/dashboard-section'
import { CalculatorsSection } from '@/components/sections/calculators-section'
import { PipelinesSection } from '@/components/sections/pipelines-section'
import { WorkflowBuilderSection } from '@/components/sections/workflow-builder-section'
import { UnitConverterSection } from '@/components/sections/unit-converter-section'
import { LearningSection } from '@/components/sections/learning-section'
import { DataAnalysisSection } from '@/components/sections/data-analysis-section'
import { LogicSimulatorSection } from '@/components/sections/logic-simulator-section'
import { PDFEditorSection } from '@/components/sections/pdf-editor-section'
import { ElectricalSimulatorSection } from '@/components/sections/electrical-simulator-section'
import { DiagramStudioSection } from '@/components/sections/diagram-studio-section'
import { SettingsSection } from '@/components/sections/settings-section'

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
