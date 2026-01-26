type RequestInitWithBody = RequestInit & { body?: unknown };

export const createRequest = (
  url: string,
  init: RequestInitWithBody = {}
): Request => {
  const { body, headers, ...rest } = init;
  const request = new Request(url, {
    ...rest,
    body:
      body === undefined ? undefined : JSON.stringify(body),
    headers: {
      ...(body
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...headers,
    },
  });

  (request as Request & { nextUrl: URL }).nextUrl = new URL(
    url
  );
  return request;
};
