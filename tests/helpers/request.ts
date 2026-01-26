import { NextRequest } from 'next/server';

type RequestInitWithBody = RequestInit & { body?: unknown };

export const createRequest = (
  url: string,
  init: RequestInitWithBody = {}
): NextRequest => {
  const { body, headers, ...rest } = init;
  const request = new NextRequest(url, {
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
  return request;
};
