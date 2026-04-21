import ChatInterface from '@/components/ChatInterface';
import { Suspense } from 'react';
// import OllamaTest from '@/components/OllamaTest';

export default function Home() {
  return (
    <main>
      <Suspense fallback={<div className="flex justify-center p-8">Loading chat interface...</div>}>
        <ChatInterface />
      </Suspense>
    </main>
  );
}
