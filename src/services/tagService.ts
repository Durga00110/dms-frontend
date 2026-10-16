const API_URL =  import.meta.env.VITE_API_BASE_URL + '/documentTags';

interface TagApiItem {
  id: string;
  label: string;
}

interface TagApiResponse {
  status: boolean;
  data: TagApiItem[];
}

export const fetchTagSuggestions = async (
  term: string,
  token: string,
  signal?: AbortSignal,
): Promise<string[]> => {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      token, // match the auth header your documentSearchService uses
    },
    body: JSON.stringify({ term }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch tags (${response.status})`);
  }

  const json: TagApiResponse = await response.json();

  if (!json.status) return [];

  return (json.data ?? []).map((item) => item.label).filter(Boolean);
};