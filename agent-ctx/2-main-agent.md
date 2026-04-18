# Task 2: Rewrite Engineering Calculators Section - DB Inputs/Outputs as Primary Source

## Agent: Main Agent
## Status: COMPLETED

## Summary
Rewrote `/home/z/my-project/src/components/sections/calculators-section.tsx` to use DB `inputs[]` and `outputs[]` from the API response as the PRIMARY source of truth for bidirectional solving, instead of formula parsing.

## Key Changes

### 1. DB Inputs/Outputs as PRIMARY source
- New `buildVariableDescriptors()` function merges DB inputs/outputs into unified `VariableDescriptor[]`
- Each descriptor carries: symbol, name, unit, description, helpText, placeholder, isOutput, defaultValue, minValue, maxValue, precision, formatString, order, dbSource
- `parseFormulaVariables()` kept as FALLBACK only when DB inputs/outputs are empty
- Also detects formula variables not in DB and adds them as `dbSource: 'fallback'`

### 2. ALL variables editable (inputs AND outputs)
- Both input and output fields use `<Input type="number">`
- Users can fill all inputs → outputs auto-calculate (forward solve)
- Users can fill output + all inputs except one → missing input auto-calculates (reverse solve)
- Only ONE empty variable needed for auto-solve

### 3. Instant auto-calculation with 300ms debounce
- `useEffect` watches `variableValues` changes
- 300ms debounce via `setTimeout`/`clearTimeout`
- Visual spinner indicator when calculating
- No mandatory "Calculate" button click (but button retained as manual option)

### 4. Visual distinction
- **Input fields**: standard border, emerald symbol color
- **Output fields**: amber-tinted background, amber border, amber symbol color
- **Auto-calculated fields**: emerald green border + emerald bg tint + "auto" badge with Sparkles icon
- **Manually overridden outputs**: amber border + "manual" badge
- **Empty required fields**: dashed border to prompt user input

### 5. Formula display
- Shows LaTeX if `equation_latex` available, otherwise plain text
- Displayed in muted background box with "FORMULA" label

### 6. Robust solver
- **Forward solve**: `evaluateFullFormula()` evaluates all statements sequentially
- **Reverse solve**: `numericalSolve()` uses bisection method with progressive bound narrowing
- Handles multi-statement formulas (separated by `;` or `\n`)
- `clientEval()` safe expression evaluator with math function support
- `solveForUnknown()` tries direct evaluation first, then numerical bisection

### 7. Error handling
- Multiple empty variables → tells user which ones need values
- NaN/Infinity results → "invalid value" message
- Reverse solve failure → helpful message suggesting different value combinations
- Calculation exceptions → shows error message

### 8. Reset button
- Resets all fields to DB defaults (inputs get `default_value`, outputs get empty)
- Clears auto-calculated and manually-overridden state

### 9. Category/domain filtering
- Retained sidebar with search input and domain Select dropdown
- Domain list combines static domains with dynamic domains from loaded equations
- Equations show input/output count badges

### 10. Responsive design
- `grid gap-3 sm:grid-cols-2 lg:grid-cols-3` for variable fields
- `flex flex-col lg:flex-row` for sidebar + main layout
- Mobile-friendly touch targets

## Technical Details
- All types properly defined with DB column names matching API response
- No API route changes required
- Component is `'use client'`
- Uses shadcn/ui: Card, Input, Button, Badge, Select, ScrollArea, Separator, Tooltip, Label
- Uses Lucide icons
- Emerald green primary accent (not blue/indigo)
- Dark mode support via Tailwind dark: variants
- Lint passes cleanly with no errors
