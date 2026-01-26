type CookieOptions = {
  httpOnly?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  maxAge?: number;
  path?: string;
};

const formatSameSite = (
  value: CookieOptions['sameSite']
) => {
  if (!value) return '';
  return `SameSite=${value[0].toUpperCase()}${value.slice(1)}`;
};

export class NextResponse extends Response {
  cookies: {
    set: (
      name: string,
      value: string,
      options?: CookieOptions
    ) => void;
  };

  constructor(body?: BodyInit | null, init?: ResponseInit) {
    super(body, init);
    this.cookies = {
      set: (name, value, options) => {
        const parts = [`${name}=${value}`];
        if (options?.path)
          parts.push(`Path=${options.path}`);
        if (typeof options?.maxAge === 'number') {
          parts.push(`Max-Age=${options.maxAge}`);
        }
        if (options?.httpOnly) parts.push('HttpOnly');
        if (options?.sameSite) {
          const sameSite = formatSameSite(options.sameSite);
          if (sameSite) parts.push(sameSite);
        }
        this.headers.append('Set-Cookie', parts.join('; '));
      },
    };
  }

  static json(data: unknown, init: ResponseInit = {}) {
    const headers = new Headers(init.headers);
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return new NextResponse(JSON.stringify(data), {
      ...init,
      headers,
    });
  }
}

export type NextRequest = Request;
