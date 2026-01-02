/**
 * Attempts Database Setup Component
 * Creates the attempts database if it doesn't exist
 */

import { useState } from 'react';
import { AlertTriangle, CheckCircle, Loader2, Database } from 'lucide-react';
import { createAttemptsDatabase } from '../services/notion.js';

export const AttemptsDatabaseSetup = ({ apiKey, onDatabaseCreated, onCancel }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);
  const [createdDatabase, setCreatedDatabase] = useState(null);

  const handleCreate = async () => {
    if (!apiKey) {
      setError('Notion API key is required');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const database = await createAttemptsDatabase(apiKey);
      setCreatedDatabase(database);
      onDatabaseCreated?.(database.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  if (createdDatabase) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <CheckCircle className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Database Created!</h3>
            <p className="text-xs text-gray-400">Your attempts database is ready</p>
          </div>
        </div>

        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <div className="text-xs font-semibold text-green-400 mb-1">Database Details</div>
          <div className="text-sm text-gray-300 space-y-1">
            <div><span className="text-gray-500">Name:</span> {createdDatabase.title?.[0]?.plain_text || 'Attempts'}</div>
            <div><span className="text-gray-500">ID:</span> <code className="text-blue-400 text-xs">{createdDatabase.id}</code></div>
          </div>
        </div>

        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="text-xs text-blue-400 mb-1">✅ Next Steps</div>
          <div className="text-xs text-gray-300">
            The database has been created and will be automatically detected. You can now start using the Interview Prep Platform!
          </div>
        </div>

        <button
          onClick={() => onDatabaseCreated?.(createdDatabase.id)}
          className="w-full py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg font-medium text-white hover:from-blue-400 hover:to-indigo-500"
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-blue-500/20 rounded-lg">
          <Database className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h3 className="font-semibold text-white">Setup Attempts Database</h3>
          <p className="text-xs text-gray-400">Create a database to track your learning attempts</p>
        </div>
      </div>

      <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
        <div className="flex items-start gap-2 text-yellow-400 mb-2">
          <AlertTriangle className="w-4 h-4 mt-0.5" />
          <div className="text-xs font-semibold">No Attempts Database Found</div>
        </div>
        <div className="text-xs text-gray-300">
          The system needs an attempts database to track your learning progress. We can create one for you automatically.
        </div>
      </div>

      <div className="p-3 bg-white/5 rounded-lg border border-white/10">
        <div className="text-xs font-semibold text-gray-400 mb-2 uppercase">What Will Be Created</div>
        <div className="text-xs text-gray-300 space-y-1">
          <div>• <strong>Item</strong> - Relation to your learning databases</div>
          <div>• <strong>Result</strong> - Select (Solved, Partial, Failed, Skipped)</div>
          <div>• <strong>Time Spent</strong> - Number field</div>
          <div>• <strong>Sheet</strong> - Domain selection (DSA, OS, DBMS, etc.)</div>
          <div>• <strong>Confidence</strong> - High, Medium, Low</div>
          <div>• <strong>Hint Used</strong> - Checkbox</div>
          <div>• <strong>Mistake Tags</strong> - Multi-select</div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="text-xs text-red-400">{error}</div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium text-gray-300"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleCreate}
          disabled={isCreating || !apiKey}
          className="flex-1 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg font-medium text-white hover:from-blue-400 hover:to-indigo-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isCreating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Database className="w-4 h-4" />
              Create Database
            </>
          )}
        </button>
      </div>
    </div>
  );
};

