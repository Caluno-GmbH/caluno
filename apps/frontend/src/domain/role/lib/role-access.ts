/**
 * Role definitions are organization-wide and the backend only accepts role
 * mutations from the top unit. A sub-org admin can assign roles, but must not
 * see an editable role form.
 */
export function canManageRoles(input: {
  isRoot?: boolean;
  hasRoleManage?: boolean;
}): boolean {
  return input.isRoot === true && input.hasRoleManage === true;
}
