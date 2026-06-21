import { useNavigate } from 'react-router-dom';
import { Button, EmptyState } from '@/components/ui';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <EmptyState
      title="Page not found"
      message="The view you are looking for does not exist."
      action={
        <Button variant="primary" onClick={() => navigate('/')}>
          Back to Overview
        </Button>
      }
    />
  );
}
