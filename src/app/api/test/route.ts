import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { url, method, headers = {}, data = null } = body;

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        if (!method) {
            return NextResponse.json({ error: 'Method is required' }, { status: 400 });
        }

        const startTime = Date.now();

        // Prepare fetch options
        const fetchOptions: RequestInit = {
            method: method.toUpperCase(),
            headers: {
                'Content-Type': 'application/json',
                ...headers,
            },
        };

        // Add body for methods that support it
        if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && data) {
            fetchOptions.body = typeof data === 'string' ? data : JSON.stringify(data);
        }

        // Make the API call
        const response = await fetch(url, fetchOptions);
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        // Get response data
        let responseData;
        const contentType = response.headers.get('content-type');

        if (contentType && contentType.includes('application/json')) {
            try {
                responseData = await response.json();
            } catch {
                responseData = await response.text();
            }
        } else {
            responseData = await response.text();
        }

        // Get response headers
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
            responseHeaders[key] = value;
        });

        return NextResponse.json({
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
            data: responseData,
            responseTime,
            url: response.url,
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
