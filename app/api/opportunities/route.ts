import { NextResponse } from 'next/server';
import { buildOpportunities, type MerchantEvent } from '@/lib/opportunity-engine';
import { buildStoredOpportunities } from '@/lib/opportunity-repository';
import { requireUserId } from '@/lib/request-user';
import type { Voucher } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const userId = requireUserId(request);
    const url = new URL(request.url);
    const preferredCategories = url.searchParams.get('categories')
      ?.split(',')
      .map(value => value.trim())
      .filter(Boolean);
    const distanceParam = url.searchParams.get('maxDistanceKm');
    const maxDistanceKm = distanceParam == null ? undefined : Number(distanceParam);
    if (maxDistanceKm != null && (!Number.isFinite(maxDistanceKm) || maxDistanceKm < 0)) {
      throw new Error('maxDistanceKm ist ungültig.');
    }

    const opportunities = await buildStoredOpportunities(userId, { preferredCategories, maxDistanceKm });
    return NextResponse.json({ opportunities });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nutzungschancen konnten nicht geladen werden' },
      { status: 400 }
    );
  }
}

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
