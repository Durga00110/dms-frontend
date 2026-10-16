import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchTagSuggestions } from "../services/tagService";

const useDebouncedValue = <T,>(value: T, delay = 300): T => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
};

export const useTagSuggestions = (term: string, enabled: boolean) => {
  const debouncedTerm = useDebouncedValue(term.trim(), 300);

  return useQuery({
    queryKey: ["tag-suggestions", debouncedTerm],
    queryFn: ({ signal }) => {
      const token = localStorage.getItem("token") ?? "";
      return fetchTagSuggestions(debouncedTerm, token, signal);
    },
    // only call the API once the user has typed something
    enabled: enabled && debouncedTerm.length >= 1,
    staleTime: 60_000,
    placeholderData: (prev) => prev, // React Query v5
  });
};