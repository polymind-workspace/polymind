import { Navigate, useParams } from '@umijs/max';

export default function DisputeDetailPage() {
  const { id = '' } = useParams();
  return <Navigate to={`/tasks/disputes?dispute=${encodeURIComponent(id)}`} replace />;
}
