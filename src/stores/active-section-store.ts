import { create } from 'zustand'

type SectionId = 
  | 'dashboard' 
  | 'calculators' 
  | 'pipelines' 
  | 'workflow' 
  | 'unit-converter' 
  | 'learning' 
  | 'data-analysis'
  | 'logic-simulator'
  | 'pdf-editor'
  | 'electrical-simulator'
  | 'diagram-studio'
  | 'settings'

interface ActiveSectionStore {
  activeSection: SectionId
  setActiveSection: (section: SectionId) => void
}

export const useActiveSection = create<ActiveSectionStore>((set) => ({
  activeSection: 'dashboard',
  setActiveSection: (section) => set({ activeSection: section }),
}))

export type { SectionId }
