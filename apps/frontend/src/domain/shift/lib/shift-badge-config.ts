export function getVisibilityConfig(t: (key: string) => string) {
  return {
    ALL_MEMBERS: {
      variant: 'outline' as const,
      label: t('visibility.ALL_MEMBERS'),
    },
    INVITED_MEMBERS: {
      variant: 'neutral' as const,
      label: t('visibility.INVITED_MEMBERS'),
    },
  };
}

export function getApprovalConfig(
  t: (key: string) => string,
  joinRequiresApproval: boolean,
) {
  return joinRequiresApproval
    ? {
        variant: 'neutral' as const,
        label: t('detail.approvalRequiredLabel'),
      }
    : {
        variant: 'outline' as const,
        label: t('detail.approvalNotRequiredLabel'),
      };
}
