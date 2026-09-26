'use client';

import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = 'Search' }: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    const handler = setTimeout(() => {
      onChange(localValue);
    }, 300);
    return () => clearTimeout(handler);
  }, [localValue, onChange]);

  return (
    <div className="relative w-full max-w-2xl">
      <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
      <input
        type="text"
        className="w-full pl-9 pr-9 py-2 border border-gray-200 rounded-lg text-sm placeholder-gray-400 bg-white outline-none focus:border-green-500 transition-colors"
        placeholder={placeholder}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
      />
      {localValue.length > 0 && (
        <button
          className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
          onClick={() => {
            setLocalValue('');
            onChange('');
          }}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
