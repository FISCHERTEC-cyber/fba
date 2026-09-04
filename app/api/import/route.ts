import { NextRequest, NextResponse } from 'next/server';
import { normaliseExtraction, reviewFlags } from '@/lib/extraction';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const extraction = normaliseExtraction(body);
    const flags = reviewFlags(extraction);

    return NextResponse.json({
      status: flags.length ? 'REVIEW_REQUIRED' : 'READY',
      extraction,
      reviewFlags: flags
    });
  } catch (error) {
    return NextResponse.json({
      status: 'INVALID',
      error: error instanceof Error ? error.message : 'Unknown validation error'
    }, { status: 400 });
  }
}
