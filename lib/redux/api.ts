import {
  createApi,
  fetchBaseQuery,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';

export type JsonQueryArg = {
  url: string;
  tag?: string;
  params?: Record<string, string | number | boolean | undefined>;
};

export type ApiRequestArg = {
  url: string;
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  invalidate?: string[];
};

const baseQuery = fetchBaseQuery({
  baseUrl: '',
  credentials: 'include',
  cache: 'no-store',
});

function tagValue(tag: string) {
  return { type: 'Api' as const, id: tag };
}

export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Api'],
  refetchOnFocus: false,
  refetchOnReconnect: false,
  keepUnusedDataFor: 60,
  endpoints: (builder) => ({
    getJson: builder.query<unknown, JsonQueryArg>({
      query: ({ url, params }) => ({ url, params }),
      providesTags: (_result, _error, arg) => [tagValue(arg.tag || arg.url)],
    }),
    request: builder.mutation<unknown, ApiRequestArg>({
      query: ({ url, method = 'POST', body }) => ({
        url,
        method,
        body,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      }),
      invalidatesTags: (_result, error, arg) => {
        if (error) return [];
        return (arg.invalidate || []).map(tagValue);
      },
    }),
  }),
});

export const {
  useGetJsonQuery,
  useLazyGetJsonQuery,
  useRequestMutation,
} = api;

export function apiErrorMessage(error: FetchBaseQueryError | unknown, fallback = 'Request failed') {
  if (!error) return fallback;
  if (typeof error === 'object' && error && 'data' in error) {
    const data = (error as { data?: unknown }).data;
    if (typeof data === 'string' && data) return data;
    if (data && typeof data === 'object' && 'error' in data && typeof (data as any).error === 'string') {
      return (data as any).error;
    }
    if (data && typeof data === 'object' && 'message' in data && typeof (data as any).message === 'string') {
      return (data as any).message;
    }
  }
  return fallback;
}
