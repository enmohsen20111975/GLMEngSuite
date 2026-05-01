import { NextRequest, NextResponse } from 'next/server';
import { calculateTrunkingSize, TrunkingInput } from '@/lib/engineering/electrical-calculations';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = calculateTrunkingSize(body as TrunkingInput);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
