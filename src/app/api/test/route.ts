import { NextRequest, NextResponse } from 'next/server';
import { httpRequest } from '@/lib/httpRequest';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { url, method, headers = {}, data = null } = body;

        if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        if (!method) return NextResponse.json({ error: 'Method is required' }, { status: 400 });

        const result = await httpRequest({ url, method, headers, data });
        return NextResponse.json(result, {
            headers: {
                'X-Cache': result.fromCache ? 'HIT' : 'MISS',
            },
        });

    } catch (error) {
        console.error('API Test Error:', error);
        return NextResponse.json(
            {
                error: 'Failed to make request',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
