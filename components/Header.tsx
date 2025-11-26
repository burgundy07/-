import React from 'react';
import { BookOpen, Languages } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-3">
      <div className="flex items-center space-x-3">
        <div className="bg-gradient-to-tr from-blue-500 to-indigo-600 p-3 rounded-xl shadow-lg shadow-blue-200">
          <BookOpen className="w-8 h-8 text-white" />
        </div>
        <div className="bg-gradient-to-tr from-emerald-400 to-teal-500 p-3 rounded-xl shadow-lg shadow-teal-200">
          <Languages className="w-8 h-8 text-white" />
        </div>
      </div>
      <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-teal-600">
        段落朗读与翻译助手
      </h1>
      <p className="text-slate-500 text-sm">
        Natural Reading & Translation Assistant
      </p>
    </div>
  );
};
