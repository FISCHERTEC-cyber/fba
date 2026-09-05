import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/request-user';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const userId = await requireUserId(request);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
    return NextResponse.json({ authenticated: true, user });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
