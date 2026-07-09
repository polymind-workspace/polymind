import { Navigate, useParams } from '@umijs/max';

export default function EventDetailPage() {
  const { slug = '' } = useParams();
  return <Navigate to={`/events/list?event=${encodeURIComponent(slug)}`} replace />;
}
