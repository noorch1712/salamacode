import React, { useState } from 'react';

export function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-slate-800">TestApp Workspace</h1>
        <p className="text-slate-500 mt-2">Managed by SalamaCode AI Coding Agent</p>
        <div className="mt-6">
          <button
            onClick={() => setCount((c) => c + 1)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Count is {count}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
