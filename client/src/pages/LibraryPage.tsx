import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';

export default function LibraryPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-navy">Your Episodes</h1>
        <Link to="/studio" className="btn-primary">
          <Plus className="w-5 h-5 inline-block mr-2" />
          Create New Episode
        </Link>
      </div>

      <div className="card">
        <p className="text-gray-500 text-center py-12">
          No episodes yet. Create your first dialogue to get started!
        </p>
      </div>
    </div>
  );
}
