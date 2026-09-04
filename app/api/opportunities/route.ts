import { NextResponse } from 'next/server';
import { buildOpportunities, type MerchantEvent } from '@/lib/opportunity-engine';
import type { Voucher } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      vouchers: Voucher[];
      events: MerchantEvent[];
      context?: { now?: string; preferredCategories?: string[]; maxDistanceKm?: number };
    };

    const opportunities = buildOpportunities(
      body.vouchers ?? [],
      body.events ?? [],
      {
        now: body.context?.now ?? new Date().toISOString(),
        preferredCategories: body.context?.preferredCategories,
        maxDistanceKm: body.context?.maxDistanceKm
      }
    );

    return NextResponse.json({ opportunities });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Opportunity-Bewertung fehlgeschlagen' },
      { status: 400 }
    );
  }
}
