import { useState } from 'react';
import { Download, ChevronDown, ChevronUp } from 'lucide-react';

interface FormatResult {
  format: string;
  preprocessedText?: string;
  durationSeconds?: number;
  audioUrl?: string;
}

interface TestResults {
  format?: string;
  preprocessedText?: string;
  durationSeconds?: number;
  audioUrl?: string;
  originalText?: string;
  allFormats?: FormatResult[];
}

interface ResultsViewerProps {
  results: TestResults | null;
}

const ResultsViewer = ({ results }: ResultsViewerProps) => {
  const [isJsonExpanded, setIsJsonExpanded] = useState(false);

  if (!results) {
    return null;
  }

  // Handle multiple formats view
  if (results.allFormats) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-navy">All Formats Comparison</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {results.allFormats.map((result, index) => (
            <div key={`format-${result.format || index}`} className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-navy mb-2 capitalize">
                {result.format.replace('_', ' ')}
              </h4>
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="text-gray-600">Preprocessed:</span>
                  <p className="font-mono text-xs bg-gray-50 p-2 rounded mt-1">
                    {result.preprocessedText}
                  </p>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">Duration:</span> {result.durationSeconds}s
                </div>
                {result.audioUrl && (
                  <div className="space-y-2">
                    <audio controls className="w-full" src={result.audioUrl}>
                      Your browser does not support the audio element.
                    </audio>
                    <a
                      href={result.audioUrl}
                      download={`test-${result.format}.mp3`}
                      className="btn-secondary flex items-center gap-2 justify-center text-sm"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Handle single format view
  return (
    <div className="space-y-4">
      {/* Audio Player */}
      {results.audioUrl && (
        <div>
          <label htmlFor="audio-player" className="block text-sm font-medium text-gray-700 mb-2">Audio</label>
          <audio id="audio-player" controls className="w-full mb-2" src={results.audioUrl}>
            Your browser does not support the audio element.
          </audio>
          <a
            href={results.audioUrl}
            download={`test-${results.format}.mp3`}
            className="btn-secondary flex items-center gap-2 w-fit"
          >
            <Download className="w-4 h-4" />
            Download Audio
          </a>
        </div>
      )}

      {/* Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="block text-sm font-medium text-gray-700 mb-1">Format</div>
          <p className="text-sm text-gray-900 capitalize">
            {results.format?.replace('_', ' ') || 'N/A'}
          </p>
        </div>
        <div>
          <div className="block text-sm font-medium text-gray-700 mb-1">Duration</div>
          <p className="text-sm text-gray-900">{results.durationSeconds || 0}s</p>
        </div>
      </div>

      {/* Text Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="block text-sm font-medium text-gray-700 mb-1">Original Text</div>
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
            <p className="text-sm font-mono">{results.originalText || 'N/A'}</p>
          </div>
        </div>
        <div>
          <div className="block text-sm font-medium text-gray-700 mb-1">
            Preprocessed Text (sent to TTS)
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-sm font-mono">{results.preprocessedText || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* JSON Viewer (Collapsible) */}
      <div>
        <button
          type="button"
          onClick={() => setIsJsonExpanded(!isJsonExpanded)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-indigo transition-colors"
        >
          {isJsonExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Full JSON Response
        </button>
        {isJsonExpanded && (
          <div className="mt-2 bg-gray-900 text-green-400 rounded-lg p-4 overflow-x-auto">
            <pre className="text-xs font-mono">{JSON.stringify(results, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultsViewer;
