import type { ReactNode } from 'react';
import { Breadcrumbs, Link, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  /** Omitted for the current page, which renders as plain text, not a link. */
  to?: string;
}

interface PageBreadcrumbsProps {
  items: readonly BreadcrumbItem[];
}

/**
 * Renders a breadcrumb trail back to the Dashboard: every item but the last
 * is a link, the last is the current page (plain text, `aria-current`) --
 * used on every page below the Dashboard so there's always a clear way back
 * that doesn't depend on the browser's back button.
 */
export function PageBreadcrumbs({ items }: PageBreadcrumbsProps): ReactNode {
  return (
    <Breadcrumbs aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        if (isLast || !item.to) {
          return (
            <Typography key={item.label} color="text.primary" aria-current={isLast ? 'page' : undefined}>
              {item.label}
            </Typography>
          );
        }
        return (
          <Link key={item.label} component={RouterLink} to={item.to} underline="hover" color="inherit">
            {item.label}
          </Link>
        );
      })}
    </Breadcrumbs>
  );
}
