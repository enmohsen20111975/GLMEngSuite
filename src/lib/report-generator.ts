/**
 * Report Generator - HTML/PDF report generation for engineering calculations
 */

export interface ReportStepResult {
  stepNumber: number
  stepName: string
  inputs: Record<string, number | string>
  outputs: Record<string, number | string | boolean>
}

export interface ReportConfig {
  title: string
  description: string
  domain: string
  difficulty: string
  icon: string
  steps: ReportStepResult[]
}

function formatValue(val: number | string | boolean, precision: number = 2): string {
  if (typeof val === 'boolean') return val ? '✅ PASS' : '❌ FAIL'
  if (typeof val === 'number') return val.toFixed(precision)
  return String(val)
}

export function generateHtmlReport(config: ReportConfig): string {
  const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })

  let stepSections = ''
  for (const result of config.steps) {
    const inputRows = Object.entries(result.inputs)
      .map(([key, val]) => `<tr><td>${key}</td><td><strong>${formatValue(val)}</strong></td></tr>`)
      .join('')

    const outputRows = Object.entries(result.outputs)
      .map(([key, val]) => {
        const cls = typeof val === 'boolean' ? (val ? 'pass' : 'fail') : ''
        return `<tr class="${cls}"><td>${key}</td><td><strong>${formatValue(val)}</strong></td></tr>`
      })
      .join('')

    stepSections += `
      <div class="step-section">
        <div class="step-header">
          <span class="step-badge">Step ${result.stepNumber}</span>
          <h2>${result.stepName}</h2>
        </div>
        <div class="two-col">
          <div>
            <h3>Inputs</h3>
            <table><thead><tr><th>Parameter</th><th>Value</th></tr></thead><tbody>${inputRows}</tbody></table>
          </div>
          <div>
            <h3>Results</h3>
            <table><thead><tr><th>Parameter</th><th>Value</th></tr></thead><tbody>${outputRows}</tbody></table>
          </div>
        </div>
      </div>`
  }

  // Compliance summary
  let complianceSummary = ''
  for (const result of config.steps) {
    for (const [key, val] of Object.entries(result.outputs)) {
      if (typeof val === 'boolean') {
        const cls = val ? 'pass' : 'fail'
        complianceSummary += `<div class="compliance-item ${cls}">
          <strong>Step ${result.stepNumber}: ${key}</strong>
          <span>${val ? '✅ PASS' : '❌ FAIL'}</span>
        </div>`
      }
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${config.title} — Engineering Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1a1a2e; background: #f8f9fa; }
  .page { max-width: 1100px; margin: 0 auto; padding: 32px; background: #fff; }
  .report-header { background: linear-gradient(135deg, #1565c0 0%, #0d47a1 100%); color: #fff; padding: 32px 36px; border-radius: 12px; margin-bottom: 32px; }
  .report-header h1 { font-size: 26px; font-weight: 700; margin-bottom: 6px; }
  .report-header .subtitle { font-size: 14px; opacity: 0.85; }
  .report-meta { display: flex; gap: 24px; margin-top: 16px; }
  .report-meta span { font-size: 12px; opacity: 0.8; }
  .domain-badge { background: rgba(255,255,255,0.2); border-radius: 20px; padding: 3px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  .compliance-summary { background: #f5f5f5; border-radius: 10px; padding: 20px 24px; margin-bottom: 28px; }
  .compliance-summary h2 { font-size: 15px; margin-bottom: 12px; color: #333; }
  .compliance-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 14px; border-radius: 6px; margin-bottom: 6px; font-size: 13px; }
  .compliance-item.pass { background: #e8f5e9; color: #1b5e20; }
  .compliance-item.fail { background: #ffebee; color: #b71c1c; }
  .step-section { border: 1px solid #e0e0e0; border-radius: 10px; padding: 24px; margin-bottom: 24px; }
  .step-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
  .step-badge { background: #1565c0; color: #fff; border-radius: 20px; padding: 3px 12px; font-size: 11px; font-weight: 600; }
  .step-header h2 { font-size: 17px; color: #1a1a2e; flex: 1; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 16px; }
  h3 { font-size: 13px; font-weight: 600; color: #1565c0; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.4px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #1565c0; color: #fff; padding: 7px 10px; text-align: left; font-weight: 500; }
  td { padding: 6px 10px; border-bottom: 1px solid #f0f0f0; }
  tr:last-child td { border-bottom: none; }
  tr:nth-child(even) td { background: #fafafa; }
  tr.pass td { background: #e8f5e9 !important; }
  tr.fail td { background: #ffebee !important; }
  .report-footer { margin-top: 40px; border-top: 1px solid #e0e0e0; padding-top: 16px; text-align: center; font-size: 11px; color: #999; }
  @media (max-width: 700px) { .two-col { grid-template-columns: 1fr; } }
  @media print { body { background: #fff; } .page { padding: 16px; } .step-section { page-break-inside: avoid; } }
</style>
</head>
<body>
<div class="page">
  <div class="report-header">
    <div class="domain-badge">${config.domain.toUpperCase()} ENGINEERING</div>
    <h1>${config.icon} ${config.title}</h1>
    <p class="subtitle">${config.description}</p>
    <div class="report-meta">
      <span>📅 Date: ${date}</span>
      <span>📊 Difficulty: ${config.difficulty}</span>
      <span>📋 ${config.steps.length} steps completed</span>
    </div>
  </div>
  ${complianceSummary ? `<div class="compliance-summary"><h2>Compliance Summary</h2>${complianceSummary}</div>` : ''}
  ${stepSections}
  <div class="report-footer">
    <p>Generated by EngiSuite — Engineering Calculation Platform</p>
    <p style="margin-top:4px">This report is for engineering reference only. All designs must be reviewed by a licensed professional engineer.</p>
  </div>
</div>
</body>
</html>`
}

export function generateJsonReport(config: ReportConfig) {
  return {
    title: config.title,
    description: config.description,
    domain: config.domain,
    generated_at: new Date().toISOString(),
    steps: config.steps
  }
}
