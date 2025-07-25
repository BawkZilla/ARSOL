"use client";
import dynamic from 'next/dynamic';

// Dynamically import the ARComponent to ensure it only runs on the client side
const ARComponent = dynamic(
  () => import('../components/ARComponent'),
  { ssr: false }
);

export default function ARTestPage() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ARComponent />
    </div>
  );
}
