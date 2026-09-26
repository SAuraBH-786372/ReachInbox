import React from 'react';
import { Button } from '@/components/ui/Button';

export default function DashboardPage() {
  return (
    <div className="p-8 space-y-6">
       <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
       <div className="p-6 rounded-2xl bg-white border border-gray-200 shadow-sm">
         <p className="text-gray-600 text-sm">Welcome to your dashboard.</p>
       </div>
    </div>
  );
}
