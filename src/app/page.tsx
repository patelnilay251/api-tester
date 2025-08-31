'use client';

import { useState } from 'react';

interface RequestData {
  url: string;
  method: string;
  headers: string;
  data: string;
}

interface ResponseData {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  responseTime: number;
  url: string;
}

export default function Home() {
  const [request, setRequest] = useState<RequestData>({
    url: '',
    method: 'GET',
    headers: '',
    data: ''
  });

  const [response, setResponse] = useState<ResponseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResponse(null);

    try {
      // Parse headers
      let parsedHeaders = {};
      if (request.headers.trim()) {
        try {
          parsedHeaders = JSON.parse(request.headers);
        } catch {
          // Try to parse as key:value pairs
          const headerLines = request.headers.split('\n');
          parsedHeaders = headerLines.reduce((acc: any, line) => {
            const [key, value] = line.split(':').map(s => s.trim());
            if (key && value) {
              acc[key] = value;
            }
            return acc;
          }, {});
        }
      }

      // Parse request data
      let parsedData = null;
      if (request.data.trim()) {
        try {
          parsedData = JSON.parse(request.data);
        } catch {
          parsedData = request.data;
        }
      }

      const res = await fetch('/api/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: request.url,
          method: request.method,
          headers: parsedHeaders,
          data: parsedData,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Request failed');
      } else {
        setResponse(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">API Tester</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Request Panel */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Request</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* URL and Method */}
              <div className="flex gap-2">
                <select
                  value={request.method}
                  onChange={(e) => setRequest({ ...request, method: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                  <option value="PATCH">PATCH</option>
                </select>

                <input
                  type="url"
                  placeholder="Enter API URL..."
                  value={request.url}
                  onChange={(e) => setRequest({ ...request, url: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Headers */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Headers (JSON or key:value format)
                </label>
                <textarea
                  placeholder={`{"Authorization": "Bearer token"}\nor\nAuthorization: Bearer token\nContent-Type: application/json`}
                  value={request.headers}
                  onChange={(e) => setRequest({ ...request, headers: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Request Body */}
              {['POST', 'PUT', 'PATCH'].includes(request.method) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Request Body (JSON)
                  </label>
                  <textarea
                    placeholder='{"key": "value"}'
                    value={request.data}
                    onChange={(e) => setRequest({ ...request, data: e.target.value })}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !request.url}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Sending...' : 'Send Request'}
              </button>
            </form>
          </div>

          {/* Response Panel */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Response</h2>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                <p className="text-red-800">{error}</p>
              </div>
            )}

            {response && (
              <div className="space-y-4">
                {/* Status and Time */}
                <div className="flex justify-between items-center">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${response.status >= 200 && response.status < 300
                      ? 'bg-green-100 text-green-800'
                      : response.status >= 400
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                    {response.status} {response.statusText}
                  </span>
                  <span className="text-sm text-gray-600">
                    {response.responseTime}ms
                  </span>
                </div>

                {/* Response Headers */}
                <div>
                  <h3 className="font-medium text-gray-700 mb-2">Headers</h3>
                  <pre className="bg-gray-50 p-3 rounded-md text-xs overflow-x-auto">
                    {JSON.stringify(response.headers, null, 2)}
                  </pre>
                </div>

                {/* Response Body */}
                <div>
                  <h3 className="font-medium text-gray-700 mb-2">Response Body</h3>
                  <pre className="bg-gray-50 p-3 rounded-md text-xs overflow-x-auto max-h-96 overflow-y-auto">
                    {typeof response.data === 'string'
                      ? response.data
                      : JSON.stringify(response.data, null, 2)
                    }
                  </pre>
                </div>
              </div>
            )}

            {!response && !error && !loading && (
              <div className="text-center text-gray-500 py-8">
                Send a request to see the response here
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}