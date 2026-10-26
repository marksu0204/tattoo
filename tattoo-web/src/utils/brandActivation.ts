import type { BrandCode } from '../config/brands';
import {
  isPublicBrandPresentation,
  type PublicBrandPresentation,
} from './mergeBrandPresentation';

export type PublicBrandActivationStatus =
  | 'unknown_host'
  | 'loading'
  | 'active'
  | 'unsupported';

export function resolvePublicBrandActivationStatus(input: {
  isKnownHost: boolean;
  loading: boolean;
  apiValidated: boolean;
}): PublicBrandActivationStatus {
  if (!input.isKnownHost) {
    return 'unknown_host';
  }
  if (input.loading) {
    return 'loading';
  }
  if (input.apiValidated) {
    return 'active';
  }
  return 'unsupported';
}

/**
 * Type guard: true only when backend confirmed an active brand config
 * for the bootstrap identity. Narrows payload to PublicBrandPresentation.
 */
export function isPublicBrandApiActivationSuccess(
  responseOk: boolean,
  payload: unknown,
  expectedCode: BrandCode,
): payload is PublicBrandPresentation {
  if (!responseOk || !isPublicBrandPresentation(payload)) {
    return false;
  }
  return payload.code === expectedCode;
}
