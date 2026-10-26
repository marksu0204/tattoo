export function isAftercareAdminEditRequested(search: string | URLSearchParams): boolean {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  return params.get('adminEdit') === '1';
}

export function canUseAftercareAdminEditMode(options: {
  adminEditRequested: boolean;
  hasAdminToken: boolean;
  isSuperAdmin: boolean;
}): boolean {
  return options.adminEditRequested && options.hasAdminToken && options.isSuperAdmin;
}

export function shouldShowAftercareAdminEditor(options: {
  isAdminEditMode: boolean;
}): boolean {
  return options.isAdminEditMode;
}
