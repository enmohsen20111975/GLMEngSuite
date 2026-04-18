import { NextResponse } from 'next/server'

// Unit conversion data (same as before)
const UNIT_CATEGORIES = [
  {
    category: 'Length',
    conversions: [
      { from: 'm', to: 'ft', factor: 3.28084, fromSymbol: 'm', toSymbol: 'ft' },
      { from: 'm', to: 'in', factor: 39.3701, fromSymbol: 'm', toSymbol: 'in' },
      { from: 'm', to: 'cm', factor: 100, fromSymbol: 'm', toSymbol: 'cm' },
      { from: 'm', to: 'mm', factor: 1000, fromSymbol: 'm', toSymbol: 'mm' },
      { from: 'm', to: 'km', factor: 0.001, fromSymbol: 'm', toSymbol: 'km' },
      { from: 'ft', to: 'in', factor: 12, fromSymbol: 'ft', toSymbol: 'in' },
      { from: 'yd', to: 'ft', factor: 3, fromSymbol: 'yd', toSymbol: 'ft' },
    ]
  },
  {
    category: 'Area',
    conversions: [
      { from: 'm²', to: 'ft²', factor: 10.7639, fromSymbol: 'm²', toSymbol: 'ft²' },
      { from: 'm²', to: 'cm²', factor: 10000, fromSymbol: 'm²', toSymbol: 'cm²' },
      { from: 'm²', to: 'ha', factor: 0.0001, fromSymbol: 'm²', toSymbol: 'ha' },
      { from: 'ft²', to: 'in²', factor: 144, fromSymbol: 'ft²', toSymbol: 'in²' },
    ]
  },
  {
    category: 'Volume',
    conversions: [
      { from: 'm³', to: 'ft³', factor: 35.3147, fromSymbol: 'm³', toSymbol: 'ft³' },
      { from: 'm³', to: 'L', factor: 1000, fromSymbol: 'm³', toSymbol: 'L' },
      { from: 'L', to: 'gal (US)', factor: 0.264172, fromSymbol: 'L', toSymbol: 'gal' },
      { from: 'L', to: 'mL', factor: 1000, fromSymbol: 'L', toSymbol: 'mL' },
    ]
  },
  {
    category: 'Mass',
    conversions: [
      { from: 'kg', to: 'lb', factor: 2.20462, fromSymbol: 'kg', toSymbol: 'lb' },
      { from: 'kg', to: 'g', factor: 1000, fromSymbol: 'kg', toSymbol: 'g' },
      { from: 'kg', to: 'ton', factor: 0.001, fromSymbol: 'kg', toSymbol: 't' },
      { from: 'lb', to: 'oz', factor: 16, fromSymbol: 'lb', toSymbol: 'oz' },
    ]
  },
  {
    category: 'Pressure',
    conversions: [
      { from: 'Pa', to: 'kPa', factor: 0.001, fromSymbol: 'Pa', toSymbol: 'kPa' },
      { from: 'Pa', to: 'bar', factor: 0.00001, fromSymbol: 'Pa', toSymbol: 'bar' },
      { from: 'Pa', to: 'psi', factor: 0.000145038, fromSymbol: 'Pa', toSymbol: 'psi' },
      { from: 'bar', to: 'psi', factor: 14.5038, fromSymbol: 'bar', toSymbol: 'psi' },
      { from: 'MPa', to: 'psi', factor: 145.038, fromSymbol: 'MPa', toSymbol: 'psi' },
    ]
  },
  {
    category: 'Temperature',
    conversions: [
      { from: '°C', to: '°F', factor: 0, offset: 'special', fromSymbol: '°C', toSymbol: '°F' },
      { from: '°C', to: 'K', factor: 1, offset: '273.15', fromSymbol: '°C', toSymbol: 'K' },
      { from: '°F', to: '°C', factor: 0, offset: 'special', fromSymbol: '°F', toSymbol: '°C' },
    ]
  },
  {
    category: 'Energy',
    conversions: [
      { from: 'J', to: 'kJ', factor: 0.001, fromSymbol: 'J', toSymbol: 'kJ' },
      { from: 'J', to: 'kWh', factor: 0.000000277778, fromSymbol: 'J', toSymbol: 'kWh' },
      { from: 'J', to: 'BTU', factor: 0.000947817, fromSymbol: 'J', toSymbol: 'BTU' },
      { from: 'kWh', to: 'MJ', factor: 3.6, fromSymbol: 'kWh', toSymbol: 'MJ' },
    ]
  },
  {
    category: 'Power',
    conversions: [
      { from: 'W', to: 'kW', factor: 0.001, fromSymbol: 'W', toSymbol: 'kW' },
      { from: 'W', to: 'hp', factor: 0.00134102, fromSymbol: 'W', toSymbol: 'hp' },
      { from: 'W', to: 'BTU/h', factor: 3.41214, fromSymbol: 'W', toSymbol: 'BTU/h' },
      { from: 'kW', to: 'MW', factor: 0.001, fromSymbol: 'kW', toSymbol: 'MW' },
    ]
  },
]

export async function GET() {
  return NextResponse.json({ success: true, data: UNIT_CATEGORIES })
}
