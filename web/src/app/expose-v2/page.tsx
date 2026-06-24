'use client';

import { Suspense } from 'react';
import { ExposeContent } from '@/app/expose/page';

export default function ExposeV2Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-page flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      }
    >
      <ExposeContent bewerbungPath="/bewerbung-v2" />
    </Suspense>
  );
}
