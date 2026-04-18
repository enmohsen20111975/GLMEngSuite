'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Delete, RotateCcw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function ScientificCalcSection() {
  const [display, setDisplay] = React.useState('0')
  const [expression, setExpression] = React.useState('')
  const [memory, setMemory] = React.useState(0)
  const [history, setHistory] = React.useState<string[]>([])
  const [isRadians, setIsRadians] = React.useState(true)
  const [shift, setShift] = React.useState(false)
  const [lastAnswer, setLastAnswer] = React.useState(0)

  const append = (val: string) => {
    if (display === '0' && val !== '.') {
      setDisplay(val)
    } else {
      setDisplay(prev => prev + val)
    }
  }

  const clear = () => { setDisplay('0'); setExpression('') }
  const backspace = () => { setDisplay(prev => prev.length > 1 ? prev.slice(0, -1) : '0') }

  const toggleSign = () => {
    if (display.startsWith('-')) setDisplay(prev => prev.slice(1))
    else setDisplay(prev => '-' + prev)
  }

  const evaluate = () => {
    try {
      let expr = display
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/−/g, '-')
        .replace(/π/g, Math.PI.toString())
        .replace(/e(?!xp)/g, Math.E.toString())
        .replace(/(\d+)!/g, (_, n) => {
          let f = 1; for (let i = 2; i <= Number(n); i++) f *= i; return f.toString()
        })
        .replace(/√\(/g, 'Math.sqrt(')
        .replace(/∛\(/g, 'Math.cbrt(')
        .replace(/abs\(/g, 'Math.abs(')
        .replace(/log\(/g, 'Math.log10(')
        .replace(/ln\(/g, 'Math.log(')
        .replace(/exp\(/g, 'Math.exp(')

      if (isRadians) {
        expr = expr.replace(/sin\(/g, 'Math.sin(').replace(/cos\(/g, 'Math.cos(').replace(/tan\(/g, 'Math.tan(')
        expr = expr.replace(/asin\(/g, 'Math.asin(').replace(/acos\(/g, 'Math.acos(').replace(/atan\(/g, 'Math.atan(')
      } else {
        expr = expr.replace(/sin\(/g, 'Math.sin(Math.PI/180*').replace(/cos\(/g, 'Math.cos(Math.PI/180*').replace(/tan\(/g, 'Math.tan(Math.PI/180*')
      }

      // Safe evaluation using Function constructor with only Math available
      const fn = new Function('Math', `"use strict"; return (${expr})`)
      const result = fn(Math)
      const rounded = Number(Number(result).toPrecision(12))
      const resultStr = String(rounded)

      setHistory(prev => [`${display} = ${resultStr}`, ...prev].slice(0, 20))
      setExpression(display + ' =')
      setDisplay(resultStr)
      setLastAnswer(rounded)
    } catch {
      setDisplay('Error')
    }
  }

  const applyFunc = (func: string) => {
    const val = Number(display)
    const toRad = isRadians ? 1 : Math.PI / 180
    const fromRad = isRadians ? 1 : 180 / Math.PI
    let result: number

    const funcs: Record<string, () => number> = {
      'sin': () => Math.sin(val * toRad),
      'cos': () => Math.cos(val * toRad),
      'tan': () => Math.tan(val * toRad),
      'sin⁻¹': () => Math.asin(val) * fromRad / (isRadians ? fromRad / 1 : 1),
      'cos⁻¹': () => Math.acos(val) * fromRad / (isRadians ? fromRad / 1 : 1),
      'tan⁻¹': () => Math.atan(val) * fromRad / (isRadians ? fromRad / 1 : 1),
      'log': () => Math.log10(val),
      'ln': () => Math.log(val),
      '√': () => Math.sqrt(val),
      '∛': () => Math.cbrt(val),
      'x²': () => val * val,
      'x³': () => val * val * val,
      '1/x': () => 1 / val,
      '|x|': () => Math.abs(val),
      'n!': () => { let f = 1; for (let i = 2; i <= val; i++) f *= i; return f },
      '10ˣ': () => Math.pow(10, val),
      'eˣ': () => Math.exp(val),
      'ANS': () => lastAnswer,
    }

    const fn = funcs[func]
    if (fn) {
      result = fn()
      setDisplay(String(Number(result.toPrecision(12))))
    }
  }

  const sciButtons = [
    { label: shift ? 'sin⁻¹' : 'sin', action: () => applyFunc(shift ? 'sin⁻¹' : 'sin') },
    { label: shift ? 'cos⁻¹' : 'cos', action: () => applyFunc(shift ? 'cos⁻¹' : 'cos') },
    { label: shift ? 'tan⁻¹' : 'tan', action: () => applyFunc(shift ? 'tan⁻¹' : 'tan') },
    { label: shift ? '10ˣ' : 'log', action: () => applyFunc(shift ? '10ˣ' : 'log') },
    { label: shift ? 'eˣ' : 'ln', action: () => applyFunc(shift ? 'eˣ' : 'ln') },
    { label: shift ? '∛' : '√', action: () => applyFunc(shift ? '∛' : '√') },
    { label: 'x²', action: () => applyFunc('x²') },
    { label: 'x³', action: () => applyFunc('x³') },
    { label: '1/x', action: () => applyFunc('1/x') },
    { label: '|x|', action: () => applyFunc('|x|') },
    { label: 'n!', action: () => applyFunc('n!') },
    { label: 'ANS', action: () => applyFunc('ANS') },
  ]

  const memButtons = [
    { label: 'MC', action: () => setMemory(0) },
    { label: 'MR', action: () => setDisplay(String(memory)) },
    { label: 'M+', action: () => setMemory(prev => prev + Number(display)) },
    { label: 'M−', action: () => setMemory(prev => prev - Number(display)) },
    { label: 'π', action: () => setDisplay(String(Math.PI)) },
    { label: 'e', action: () => setDisplay(String(Math.E)) },
  ]

  const numButtons = [
    { label: 'AC', action: clear, className: 'text-red-500' },
    { label: '⌫', action: backspace, className: '' },
    { label: '(', action: () => append('('), className: '' },
    { label: ')', action: () => append(')'), className: '' },
    { label: '÷', action: () => append('÷'), className: 'text-emerald-600' },
    { label: '7', action: () => append('7'), className: '' },
    { label: '8', action: () => append('8'), className: '' },
    { label: '9', action: () => append('9'), className: '' },
    { label: '×', action: () => append('×'), className: 'text-emerald-600' },
    { label: '4', action: () => append('4'), className: '' },
    { label: '5', action: () => append('5'), className: '' },
    { label: '6', action: () => append('6'), className: '' },
    { label: '−', action: () => append('−'), className: 'text-emerald-600' },
    { label: '1', action: () => append('1'), className: '' },
    { label: '2', action: () => append('2'), className: '' },
    { label: '3', action: () => append('3'), className: '' },
    { label: '+', action: () => append('+'), className: 'text-emerald-600' },
    { label: '±', action: toggleSign, className: '' },
    { label: '0', action: () => append('0'), className: '' },
    { label: '.', action: () => append('.'), className: '' },
    { label: '%', action: () => append('%'), className: '' },
    { label: '=', action: evaluate, className: 'bg-emerald-600 text-white hover:bg-emerald-700' },
  ]

  const constants = [
    { label: 'c', value: '299,792,458 m/s', desc: 'Speed of light' },
    { label: 'g', value: '9.80665 m/s²', desc: 'Gravity' },
    { label: 'G', value: '6.674×10⁻¹¹', desc: 'Gravitational const' },
    { label: 'h', value: '6.626×10⁻³⁴ J·s', desc: 'Planck const' },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Scientific Calculator</h2>
        <p className="text-sm text-muted-foreground mt-1">Engineering and scientific calculations</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-4">
        <Card className="overflow-hidden">
          {/* Mode toggles */}
          <div className="flex items-center gap-2 px-4 pt-3">
            <Button variant={shift ? 'default' : 'outline'} size="sm" onClick={() => setShift(!shift)} className="text-xs h-7">
              SHIFT
            </Button>
            <Button variant={isRadians ? 'default' : 'outline'} size="sm" onClick={() => setIsRadians(true)} className="text-xs h-7">
              RAD
            </Button>
            <Button variant={!isRadians ? 'default' : 'outline'} size="sm" onClick={() => setIsRadians(false)} className="text-xs h-7">
              DEG
            </Button>
            {memory !== 0 && <Badge variant="secondary" className="text-[10px]">M</Badge>}
          </div>

          {/* Display */}
          <div className="px-4 pt-2 pb-3">
            <p className="text-xs text-muted-foreground font-mono h-5 truncate">{expression}</p>
            <p className="text-3xl font-bold font-mono text-right truncate">{display}</p>
          </div>

          {/* Scientific buttons */}
          <div className="grid grid-cols-6 gap-1 px-3 pb-2">
            {sciButtons.map(btn => (
              <Button key={btn.label} variant="outline" size="sm" onClick={btn.action} className="h-9 text-xs font-mono">
                {btn.label}
              </Button>
            ))}
          </div>

          {/* Memory buttons */}
          <div className="grid grid-cols-6 gap-1 px-3 pb-2">
            {memButtons.map(btn => (
              <Button key={btn.label} variant="ghost" size="sm" onClick={btn.action} className="h-8 text-[11px] text-muted-foreground">
                {btn.label}
              </Button>
            ))}
          </div>

          {/* Main numpad */}
          <div className="grid grid-cols-5 gap-1 px-3 pb-4">
            {numButtons.map(btn => (
              <Button
                key={btn.label}
                variant="outline"
                onClick={btn.action}
                className={`h-12 text-lg font-medium ${btn.className || ''}`}
              >
                {btn.label}
              </Button>
            ))}
          </div>
        </Card>

        {/* History & Constants */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-3">
              <h3 className="text-sm font-semibold mb-2">History</h3>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {history.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No calculations yet</p>
                ) : (
                  history.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        const result = item.split(' = ')[1]
                        setDisplay(result)
                      }}
                      className="w-full text-left text-xs py-1.5 px-2 rounded hover:bg-accent font-mono truncate"
                    >
                      {item}
                    </button>
                  ))
                )}
              </div>
              {history.length > 0 && (
                <Button variant="ghost" size="sm" className="w-full text-xs mt-2" onClick={() => setHistory([])}>
                  Clear History
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <h3 className="text-sm font-semibold mb-2">Constants</h3>
              <div className="space-y-2">
                {constants.map(c => (
                  <div key={c.label} className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold">{c.label}</span>
                    <span className="text-muted-foreground">{c.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  )
}
