export type AsyncLoadStatus = 'idle' | 'loading' | 'success' | 'error';

export type AsyncLoadState<T> = {
  status: AsyncLoadStatus;
  data: T;
  error: string | null;
  hasLoadedOnce: boolean;
};

export const createAsyncLoadState = <T>(initialData: T): AsyncLoadState<T> => ({
  status: 'idle',
  data: initialData,
  error: null,
  hasLoadedOnce: false,
});

export const startLoading = <T>(prev: AsyncLoadState<T>): AsyncLoadState<T> => ({
  ...prev,
  status: 'loading',
  error: null,
});

export const loadSuccess = <T>(prev: AsyncLoadState<T>, data: T): AsyncLoadState<T> => ({
  status: 'success',
  data,
  error: null,
  hasLoadedOnce: true,
});

export const loadError = <T>(prev: AsyncLoadState<T>, error: string): AsyncLoadState<T> => ({
  ...prev,
  status: 'error',
  error,
});
