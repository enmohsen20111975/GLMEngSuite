import { NextRequest, NextResponse } from 'next/server';
import { calculateCableTray, CableTrayInput } from '@/lib/engineering/electrical-calculations';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = calculateCableTray(body as CableTrayInput);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
