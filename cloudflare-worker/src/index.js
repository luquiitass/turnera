export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Fetch from Pages origin with pages.dev as Host
    const pagesOrigin = 'https://turnera-abc.pages.dev';
    const targetUrl = `${pagesOrigin}${path}${url.search}`;

    let response = await fetch(targetUrl, {
      cf: { cacheTtl: 300 },
    });

    // If 404 (SPA route), serve index.html
    if (response.status === 404 && !path.includes('.')) {
      response = await fetch(`${pagesOrigin}/index.html`, {
        cf: { cacheTtl: 300 },
      });
    }

    // Return with permissive headers
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.delete('x-frame-options');

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  },
};
