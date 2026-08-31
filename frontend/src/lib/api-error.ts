export interface ApiErrorBody {
  detail?: string | { detail?: string; existing_report_id?: number };
  code?: string;
  existing_report_id?: number;
}

export async function parseApiError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const body = JSON.parse(text) as ApiErrorBody;
    if (typeof body.detail === "string") return body.detail;
    if (body.detail && typeof body.detail === "object" && body.detail.detail) {
      return body.detail.detail;
    }
    if (body.code) return `${body.code}: ${text}`;
  } catch {
    // fall through
  }
  return text || `请求失败 (${response.status})`;
}

export async function parseApiErrorBody(response: Response): Promise<ApiErrorBody & { message: string }> {
  const text = await response.text();
  try {
    const body = JSON.parse(text) as ApiErrorBody;
    const message =
      typeof body.detail === "string"
        ? body.detail
        : body.detail?.detail ?? text ?? `请求失败 (${response.status})`;
    return { ...body, message };
  } catch {
    return { message: text || `请求失败 (${response.status})` };
  }
}
