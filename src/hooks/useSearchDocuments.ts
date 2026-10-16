
import { useMutation } from '@tanstack/react-query';
import {
  searchDocuments,
  type SearchDocumentPayload,
} from '../services/documentSearchService';

interface SearchVariables {
  payload: SearchDocumentPayload;
  token: string;
}

export const useSearchDocuments = () => {
  return useMutation({
    mutationFn: ({ payload, token }: SearchVariables) =>
      searchDocuments({ payload, token }),
  });
};
