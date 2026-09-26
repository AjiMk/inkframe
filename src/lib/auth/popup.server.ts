export async function handleAuthPopupRequest(request: Request): Promise<Response> {
  return new Response("Auth popup not configured", {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
