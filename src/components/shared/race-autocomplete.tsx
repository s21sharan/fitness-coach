"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

export interface RaceSearchResult {
  name: string;
  date: string;
  city: string;
  state: string;
  distance: string;
  sport_type: string;
  url: string;
  runsignup_id: number;
}

interface RaceAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelectRace: (race: RaceSearchResult) => void;
  placeholder?: string;
  inputStyle?: React.CSSProperties;
}

export function RaceAutocomplete({
  value,
  onChange,
  onSelectRace,
  placeholder = "Search races or type a name...",
  inputStyle,
}: RaceAutocompleteProps) {
  // Internal input value — mirrors prop but also tracks typed text before parent rerenders
  const [inputValue, setInputValue] = useState(value);
  const [results, setResults] = useState<RaceSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync prop changes (e.g. parent resets value)
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const doSearch = useCallback(async (query: string) => {
    setIsLoading(true);
    setSearched(false);
    try {
      const res = await fetch(`/api/races/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.results ?? []);
      setShowDropdown(true);
      setSearched(true);
    } catch {
      setResults([]);
      setSearched(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (inputValue.length < 2) {
      setShowDropdown(false);
      setResults([]);
      setSearched(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      doSearch(inputValue);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputValue, doSearch]);

  function handleSelect(race: RaceSearchResult) {
    setInputValue(race.name);
    onChange(race.name);
    onSelectRace(race);
    setShowDropdown(false);
    setResults([]);
    setSearched(false);
  }

  function handleBlur() {
    // Close dropdown on blur, but mouseDown on results fires first so we use a small delay
    setTimeout(() => setShowDropdown(false), 150);
  }

  const inputBaseStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 36px 8px 12px",
    fontSize: 14,
    color: "#111827",
    border: "1px solid var(--line, #e5e7eb)",
    borderRadius: 6,
    outline: "none",
    background: "#fff",
    boxSizing: "border-box",
    ...inputStyle,
  };

  const dropdownStyle: React.CSSProperties = {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 4,
    background: "#fff",
    border: "1px solid var(--line, #e5e7eb)",
    borderRadius: 6,
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    zIndex: 100,
    maxHeight: 300,
    overflowY: "auto",
  };

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div style={{ position: "relative" }}>
        <input
          type="text"
          value={inputValue}
          placeholder={placeholder}
          onChange={(e) => {
            const v = e.target.value;
            setInputValue(v);
            onChange(v);
          }}
          onBlur={handleBlur}
          onFocus={() => {
            if (results.length > 0 || searched) setShowDropdown(true);
          }}
          style={inputBaseStyle}
        />
        {isLoading && (
          <span
            aria-label="loading"
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              width: 16,
              height: 16,
              border: "2px solid #e5e7eb",
              borderTopColor: "#6b7280",
              borderRadius: "50%",
              animation: "spin 0.6s linear infinite",
              display: "inline-block",
            }}
          />
        )}
      </div>

      {showDropdown && (
        <div style={dropdownStyle}>
          {results.length === 0 ? (
            <div
              style={{
                padding: "10px 14px",
                fontSize: 13,
                color: "#9ca3af",
              }}
            >
              No races found
            </div>
          ) : (
            results.map((race) => (
              <div
                key={race.runsignup_id}
                data-testid="race-result-item"
                onMouseDown={() => handleSelect(race)}
                style={{
                  padding: "10px 14px",
                  cursor: "pointer",
                  borderBottom: "1px solid var(--line, #e5e7eb)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "#f3f4f6";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 14,
                    color: "#111827",
                  }}
                >
                  {race.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#6b7280",
                    marginTop: 2,
                  }}
                >
                  {race.date} · {race.city}, {race.state} · {race.distance}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
