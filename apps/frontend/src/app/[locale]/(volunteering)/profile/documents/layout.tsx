import type { ReactNode } from 'react';

export default function DocumentsLayout({
  children,
  sheet,
}: {
  children: ReactNode;
  sheet: ReactNode;
}) {
  return (
    <>
      {children}
      {sheet}
    </>
  );
}
