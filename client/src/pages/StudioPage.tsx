import DialogueGenerator from '../components/dialogue/DialogueGenerator';

export default function StudioPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-navy mb-2">Create Dialogue</h1>
        <p className="text-gray-600">
          Transform your stories and experiences into natural language learning dialogues
        </p>
      </div>

      <DialogueGenerator />
    </div>
  );
}
