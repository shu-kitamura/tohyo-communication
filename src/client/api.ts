export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

export async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const data: unknown = await response.json();

  if (!response.ok) {
    throw new ApiRequestError(readErrorMessage(data), readErrorCode(data));
  }

  return data as T;
}

function readErrorMessage(data: unknown): string {
  if (!isRecord(data)) {
    return "リクエストに失敗しました。";
  }

  if (typeof data.error === "string") {
    return data.error;
  }

  if (isRecord(data.error)) {
    const issueMessage = readFirstIssueMessage(data.error.issues);

    if (issueMessage) {
      return issueMessage;
    }

    if (typeof data.error.message === "string") {
      return data.error.message;
    }
  }

  return "入力内容を確認してください。";
}

function readErrorCode(data: unknown): string | undefined {
  return isRecord(data) && typeof data.code === "string" ? data.code : undefined;
}

function readFirstIssueMessage(issues: unknown): string | undefined {
  if (!Array.isArray(issues) || !isRecord(issues[0])) {
    return undefined;
  }

  return typeof issues[0].message === "string" ? issues[0].message : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
