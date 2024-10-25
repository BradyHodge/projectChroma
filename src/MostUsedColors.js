import React from 'react';
import useMostUsedColors from './useMostUsedColors';

function MostUsedColors({ url }) {
  const { colors, loading, error } = useMostUsedColors(url);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div>
      <h2>Most Used Colors:</h2>
      <ul>
        {colors.map(([hex, count], index) => (
          <li key={index}>
            <span style={{ backgroundColor: hex }}></span>
            {hex}: {count} occurrences
          </li>
        ))}
      </ul>
    </div>
  );
}

export default MostUsedColors;
