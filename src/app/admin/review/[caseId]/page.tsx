'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Legacy review page - redirects to enhanced version
 * All case review functionality has been consolidated into /enhanced
 */
export default function LegacyCaseReview() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.caseId as string;

  useEffect(() => {
    // Redirect to enhanced page
    router.replace(`/admin/review/${caseId}/enhanced`);
  }, [caseId, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Redirecting to case review...</p>
      </div>
    </div>
  );
}
