import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button, Card } from '../components/ui/primitives';

export default function NotFound() {
  return (
    <Card className="mx-auto max-w-lg px-6 py-16 text-center">
      <p className="font-display text-4xl font-bold text-accent">404</p>
      <h1 className="mt-3 font-display text-xl font-bold text-plum-950">Page not found</h1>
      <p className="mt-2 text-sm text-plum-700">This route does not exist in your TalentIQ portal.</p>
      <div className="mt-6 flex justify-center">
        <Link to="/"><Button icon={ArrowLeft}>Return home</Button></Link>
      </div>
    </Card>
  );
}
