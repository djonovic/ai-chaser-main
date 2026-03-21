import { Navigate } from 'react-router-dom';

/** Bookmarks to /clients open the combined Invoices & Clients page. */
export default function ClientsPage() {
  return <Navigate to="/invoices?tab=clients" replace />;
}
