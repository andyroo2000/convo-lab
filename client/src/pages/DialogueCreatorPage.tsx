import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DialogueGenerator from '../components/dialogue/DialogueGenerator';

export default function DialogueCreatorPage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => navigate('/app/create')}
          className="flex items-center gap-2 text-navy hover:text-indigo transition-colors"
          data-testid="dialogue-button-back"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Studio
        </button>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-navy mb-2">Create Interactive Dialogue</h1>
        <p className="text-gray-600">Generate an interactive language learning dialogue with AI-powered voices</p>
      </div>

      <DialogueGenerator />
    </div>
  );
}
