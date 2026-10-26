const API_URL = '/api.php';
const TOKEN_KEY = 'inkflow_admin_token';

const getAdminToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
};

const parseUploadResponse = async (response: Response) => {
  const text = await response.text();
  if (response.status === 401) {
    throw new Error('需要 Admin 登入才能上傳');
  }
  if (!response.ok) {
    let message = `Upload failed (${response.status})`;
    try {
      const json = JSON.parse(text);
      if (json?.error) message = String(json.error);
    } catch {
      if (text.trim()) message = text.trim();
    }
    throw new Error(message);
  }
  const json = JSON.parse(text);
  if (json?.error) throw new Error(String(json.error));
  return json;
};

export const isAdminAuthenticated = (): boolean => Boolean(getAdminToken());

export const upload3dModelObj = async (
  modelId: string,
  file: File
): Promise<{ success: true; url: string }> => {
  const token = getAdminToken();
  if (!token) throw new Error('需要 Admin 登入才能上傳 OBJ');

  const formData = new FormData();
  formData.append('modelId', modelId);
  formData.append('file', file);

  const response = await fetch(`${API_URL}?action=upload3dModelObj`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  return parseUploadResponse(response);
};

export const upload3dTestTexturePng = async (
  file: File
): Promise<{ success: true; url: string }> => {
  const token = getAdminToken();
  if (!token) throw new Error('需要 Admin 登入才能上傳 PNG');

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}?action=upload3dTestTexture`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  return parseUploadResponse(response);
};
