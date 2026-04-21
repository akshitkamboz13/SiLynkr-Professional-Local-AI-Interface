import Link from 'next/link';
import { ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="text-center max-w-md">
        <div className="mb-6">
          <h1 className="text-6xl font-bold text-primary">404</h1>
          <h2 className="text-2xl font-semibold text-foreground mt-2">Page Not Found</h2>
          <p className="text-muted-foreground mt-4">
            The page you are looking for does not exist or has been moved.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-6">
          <Link 
            href="/"
            className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-primary-foreground py-2 px-4 rounded-md transition-colors"
          >
            <Home size={18} />
            <span>Go to Home</span>
          </Link>
          
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 border border-border py-2 px-4 rounded-md hover:bg-muted transition-colors text-foreground"
          >
            <ArrowLeft size={18} />
            <span>Back to Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
} 