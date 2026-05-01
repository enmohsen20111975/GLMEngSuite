/**
 * Seed script: Populate EngineeringReferenceData table with data from Excel sheets
 * Run with: bun run seed:engineering
 */

import { PrismaClient } from '@prisma/client';
import {
  CABLE_IMPEDANCE_TABLE, XLPE_CABLE_LIBRARY, PVC_CABLE_LIBRARY,
  TRANSFORMER_LIBRARY, TRUNKING_SIZES
} from '../src/lib/engineering/cable-data';
import {
  MOTOR_RATINGS, MOTOR_CODE_TABLE, MCCB_SIZES,
  BUSBAR_DERATING_K1_TABLE, BUSBAR_DERATING_K2_TABLE, BUSBAR_DERATING_K3_TABLE,
  BUSBAR_DERATING_K4_TABLE, BUSBAR_DERATING_K5_TABLE, BUSBAR_DERATING_K6_TABLE,
  BUSBAR_DERATING_K8_TABLE, BUSBAR_MATERIALS,
  CONDUIT_SIZES, CABLE_OUTER_DIAMETERS,
  DEMAND_FACTORS, UTILIZATION_FACTORS, FUSE_MULTIPLIERS_NEC,
  REFLECTION_FACTORS, MAINTENANCE_FACTORS
} from '../src/lib/engineering/electrical-data';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding engineering reference data...');

  // Clear existing data
  await prisma.engineeringReferenceData.deleteMany({});
  console.log('  Cleared existing data');

  let count = 0;

  // ─── Cable Impedance Table ─────────────────────────────────────────────
  for (const [sizeKey, entry] of Object.entries(CABLE_IMPEDANCE_TABLE)) {
    await prisma.engineeringReferenceData.upsert({
      where: { category_subCategory_key: { category: 'cable_impedance', subCategory: `${entry.insulation}_${entry.conductor}`, key: String(entry.size_mm2) } },
      update: {},
      create: {
        category: 'cable_impedance',
        subCategory: `${entry.insulation}_${entry.conductor}`,
        key: String(entry.size_mm2),
        label: entry.description,
        value: JSON.stringify(entry),
        unit: 'Ω/km',
        standard: 'IEC 60364-5-52',
        order: entry.size_mm2,
      },
    });
    count++;
  }
  console.log(`  ✅ Cable impedance: ${count} entries`);

  // ─── XLPE Cable Library ────────────────────────────────────────────────
  let xlpeCount = 0;
  for (const entry of XLPE_CABLE_LIBRARY) {
    await prisma.engineeringReferenceData.upsert({
      where: { category_subCategory_key: { category: 'cable_ampacity', subCategory: 'XLPE', key: String(entry.size_mm2) } },
      update: {},
      create: {
        category: 'cable_ampacity',
        subCategory: 'XLPE',
        key: String(entry.size_mm2),
        label: `XLPE ${entry.size_mm2} mm²`,
        value: JSON.stringify(entry),
        unit: 'A',
        standard: 'IEC 60502-1',
        order: entry.size_mm2,
      },
    });
    xlpeCount++;
  }
  console.log(`  ✅ XLPE library: ${xlpeCount} entries`);

  // ─── PVC Cable Library ────────────────────────────────────────────────
  let pvcCount = 0;
  for (const entry of PVC_CABLE_LIBRARY) {
    await prisma.engineeringReferenceData.upsert({
      where: { category_subCategory_key: { category: 'cable_ampacity', subCategory: 'PVC', key: String(entry.size_mm2) } },
      update: {},
      create: {
        category: 'cable_ampacity',
        subCategory: 'PVC',
        key: String(entry.size_mm2),
        label: `PVC ${entry.size_mm2} mm²`,
        value: JSON.stringify(entry),
        unit: 'A',
        standard: 'IEC 60502-1',
        order: entry.size_mm2,
      },
    });
    pvcCount++;
  }
  console.log(`  ✅ PVC library: ${pvcCount} entries`);

  // ─── Transformer Library ────────────────────────────────────────────────
  for (const entry of TRANSFORMER_LIBRARY) {
    await prisma.engineeringReferenceData.upsert({
      where: { category_subCategory_key: { category: 'transformer', subCategory: 'impedance', key: String(entry.kVA) } },
      update: {},
      create: {
        category: 'transformer',
        subCategory: 'impedance',
        key: String(entry.kVA),
        label: `${entry.kVA} kVA Transformer`,
        value: JSON.stringify(entry),
        unit: '%',
        standard: 'IEC 60076',
        order: entry.kVA,
      },
    });
  }
  console.log(`  ✅ Transformers: ${TRANSFORMER_LIBRARY.length} entries`);

  // ─── Motor Ratings ─────────────────────────────────────────────────────
  for (let i = 0; i < MOTOR_RATINGS.length; i++) {
    const m = MOTOR_RATINGS[i];
    await prisma.engineeringReferenceData.upsert({
      where: { category_subCategory_key: { category: 'motor_ratings', subCategory: 'standard', key: String(m.kW) } },
      update: {},
      create: {
        category: 'motor_ratings',
        subCategory: 'standard',
        key: String(m.kW),
        label: `${m.kW} kW Motor`,
        value: JSON.stringify(m),
        unit: 'kW',
        standard: 'IEC 60034',
        order: i,
      },
    });
  }
  console.log(`  ✅ Motor ratings: ${MOTOR_RATINGS.length} entries`);

  // ─── Motor Code Letters ────────────────────────────────────────────────
  for (const [code, data] of Object.entries(MOTOR_CODE_TABLE)) {
    await prisma.engineeringReferenceData.upsert({
      where: { category_subCategory_key: { category: 'motor_codes', subCategory: 'NEMA', key: code } },
      update: {},
      create: {
        category: 'motor_codes',
        subCategory: 'NEMA',
        key: code,
        label: `Code ${code}`,
        value: JSON.stringify({ code, ...data }),
        unit: 'kVA/HP',
        standard: 'NEC 430-52',
        order: code.charCodeAt(0) - 65,
      },
    });
  }
  console.log(`  ✅ Motor codes: ${Object.keys(MOTOR_CODE_TABLE).length} entries`);

  // ─── Busbar Derating Factors K1-K8 ──────────────────────────────────────
  const deratingTables = [
    { data: BUSBAR_DERATING_K1_TABLE, sub: 'K1', label: 'Per Phase Strip' },
    { data: BUSBAR_DERATING_K2_TABLE, sub: 'K2', label: 'Insulating Material' },
    { data: BUSBAR_DERATING_K3_TABLE, sub: 'K3', label: 'Position' },
    { data: BUSBAR_DERATING_K4_TABLE, sub: 'K4', label: 'Installation Media' },
    { data: BUSBAR_DERATING_K5_TABLE, sub: 'K5', label: 'Ventilation' },
    { data: BUSBAR_DERATING_K6_TABLE, sub: 'K6', label: 'Enclosure' },
    { data: BUSBAR_DERATING_K8_TABLE, sub: 'K8', label: 'Altitude' },
  ];

  for (const table of deratingTables) {
    for (let i = 0; i < table.data.length; i++) {
      const entry = table.data[i] as Record<string, unknown>;
      const keyVal = Object.values(entry).find((v): v is number => typeof v === 'number') ?? i;
      await prisma.engineeringReferenceData.upsert({
        where: { category_subCategory_key: { category: 'busbar_derating', subCategory: table.sub, key: String(keyVal) } },
        update: {},
        create: {
          category: 'busbar_derating',
          subCategory: table.sub,
          key: String(keyVal),
          label: `${table.sub}: ${table.label} #${i + 1}`,
          value: JSON.stringify(entry),
          standard: 'IEC 60890',
          order: i,
        },
      });
    }
  }
  console.log(`  ✅ Busbar derating: ${deratingTables.length} tables`);

  // ─── Busbar Materials ──────────────────────────────────────────────────
  for (const [matKey, matData] of Object.entries(BUSBAR_MATERIALS)) {
    await prisma.engineeringReferenceData.upsert({
      where: { category_subCategory_key: { category: 'busbar_materials', subCategory: 'properties', key: matKey } },
      update: {},
      create: {
        category: 'busbar_materials',
        subCategory: 'properties',
        key: matKey,
        label: matData.name,
        value: JSON.stringify(matData),
        standard: 'IEC 60890',
        order: matKey === 'copper' ? 0 : 1,
      },
    });
  }
  console.log(`  ✅ Busbar materials: 2 entries`);

  // ─── Trunking Data ─────────────────────────────────────────────────────
  for (const t of TRUNKING_SIZES) {
    await prisma.engineeringReferenceData.upsert({
      where: { category_subCategory_key: { category: 'trunking', subCategory: 'trunking_size', key: `${t.width_mm}x${t.height_mm}` } },
      update: {},
      create: {
        category: 'trunking',
        subCategory: 'trunking_size',
        key: `${t.width_mm}x${t.height_mm}`,
        label: `${t.width_mm}×${t.height_mm} mm`,
        value: JSON.stringify(t),
        unit: 'mm',
        standard: 'IEEE',
        order: t.factor,
      },
    });
  }
  console.log(`  ✅ Trunking: ${TRUNKING_SIZES.length} entries`);

  // ─── Conduit Sizes ────────────────────────────────────────────────────
  for (const c of CONDUIT_SIZES) {
    await prisma.engineeringReferenceData.upsert({
      where: { category_subCategory_key: { category: 'conduit', subCategory: 'size', key: String(c.size_mm) } },
      update: {},
      create: {
        category: 'conduit',
        subCategory: 'size',
        key: String(c.size_mm),
        label: `${c.size_mm} mm Conduit`,
        value: JSON.stringify(c),
        unit: 'mm',
        standard: 'NEC',
        order: c.size_mm,
      },
    });
  }
  console.log(`  ✅ Conduit: ${CONDUIT_SIZES.length} entries`);

  // ─── MCCB Sizes ────────────────────────────────────────────────────────
  for (let i = 0; i < MCCB_SIZES.length; i++) {
    await prisma.engineeringReferenceData.upsert({
      where: { category_subCategory_key: { category: 'protection', subCategory: 'mccb', key: String(MCCB_SIZES[i]) } },
      update: {},
      create: {
        category: 'protection',
        subCategory: 'mccb',
        key: String(MCCB_SIZES[i]),
        label: `${MCCB_SIZES[i]} A MCCB`,
        value: JSON.stringify({ size_A: MCCB_SIZES[i] }),
        unit: 'A',
        standard: 'IEC 60947',
        order: i,
      },
    });
  }
  console.log(`  ✅ MCCB sizes: ${MCCB_SIZES.length} entries`);

  // ─── Cable Outer Diameters ──────────────────────────────────────────────
  for (const [sizeKey, outerDia] of Object.entries(CABLE_OUTER_DIAMETERS)) {
    await prisma.engineeringReferenceData.upsert({
      where: { category_subCategory_key: { category: 'cable_dimensions', subCategory: 'outer_dia', key: sizeKey } },
      update: {},
      create: {
        category: 'cable_dimensions',
        subCategory: 'outer_dia',
        key: sizeKey,
        label: `${sizeKey} mm² Cable`,
        value: JSON.stringify({ size_mm2: Number(sizeKey), outerDia_mm: outerDia }),
        unit: 'mm',
        standard: 'IEC 60502',
        order: Number(sizeKey),
      },
    });
  }
  console.log(`  ✅ Cable dimensions: ${Object.keys(CABLE_OUTER_DIAMETERS).length} entries`);

  // ─── Demand & Utilization Factors ──────────────────────────────────────
  for (let i = 0; i < DEMAND_FACTORS.length; i++) {
    await prisma.engineeringReferenceData.upsert({
      where: { category_subCategory_key: { category: 'load_factors', subCategory: 'demand', key: DEMAND_FACTORS[i].loadType } },
      update: {},
      create: {
        category: 'load_factors',
        subCategory: 'demand',
        key: DEMAND_FACTORS[i].loadType,
        label: DEMAND_FACTORS[i].loadType,
        value: JSON.stringify(DEMAND_FACTORS[i]),
        standard: 'IEC 61439',
        order: i,
      },
    });
  }

  for (let i = 0; i < UTILIZATION_FACTORS.length; i++) {
    await prisma.engineeringReferenceData.upsert({
      where: { category_subCategory_key: { category: 'load_factors', subCategory: 'utilization', key: UTILIZATION_FACTORS[i].loadType } },
      update: {},
      create: {
        category: 'load_factors',
        subCategory: 'utilization',
        key: UTILIZATION_FACTORS[i].loadType,
        label: UTILIZATION_FACTORS[i].loadType,
        value: JSON.stringify(UTILIZATION_FACTORS[i]),
        standard: 'IEC 61439',
        order: i,
      },
    });
  }
  console.log(`  ✅ Load factors: ${DEMAND_FACTORS.length + UTILIZATION_FACTORS.length} entries`);

  // ─── Fuse Multipliers ──────────────────────────────────────────────────
  for (let i = 0; i < FUSE_MULTIPLIERS_NEC.length; i++) {
    await prisma.engineeringReferenceData.upsert({
      where: { category_subCategory_key: { category: 'protection', subCategory: 'fuse', key: String(i) } },
      update: {},
      create: {
        category: 'protection',
        subCategory: 'fuse',
        key: String(i),
        label: FUSE_MULTIPLIERS_NEC[i].type,
        value: JSON.stringify(FUSE_MULTIPLIERS_NEC[i]),
        standard: 'NEC 430-52',
        order: i,
      },
    });
  }
  console.log(`  ✅ Fuse multipliers: ${FUSE_MULTIPLIERS_NEC.length} entries`);

  const total = await prisma.engineeringReferenceData.count();
  console.log(`\n🎉 Done! Total engineering reference data entries: ${total}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
