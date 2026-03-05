/**
 * Ticket Management Layout
 * Thin layout wrapper that renders child routes (Packages, Sales, Promo Codes).
 */
import { Outlet } from '@tanstack/react-router'

export function TicketManagementLayout() {
  return <Outlet />
}
