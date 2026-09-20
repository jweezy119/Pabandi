import React, { useState, useEffect } from 'react';

interface RecommendationProps {
  userId: string;
}

export const RecommendationCard: React.FC<RecommendationProps> = ({ userId }) => {
  const [recommendation, setRecommendation] = useState<any>(null);

  const fetchRecommendation = async () => {
    try {
      const res = await fetch(`/api/v1/recommendations/next-feature`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      if (data.success) setRecommendation(data.data);
    } catch (err) {}
  };

  useEffect(() => {
    fetchRecommendation();
  }, [userId]);

  if (!recommendation) return null;

  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: 8,
        background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(20,241,149,0.08))',
        border: '1px solid rgba(168,85,247,0.2)',
        marginTop: '12px',
        cursor: 'pointer',
      }}
      onClick={fetchRecommendation}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: recommendation.priority === 'high' ? '#14f195' : '#fbbf24',
            boxShadow: `0 0 8px ${recommendation.priority === 'high' ? '#14f195' : '#fbbf24'}`,
          }}
        />
        <span style={{ fontSize: 12, color: '#a78bfa', fontWeight: 600 }}>
          RECOMMENDED FOR YOU
        </span>
      </div>
      <p style={{ margin: '6px 0 0', fontSize: 13, color: '#e2e8f0' }}>
        {recommendation.reason}
      </p>
      {recommendation.confidence > 0 && (
        <span style={{ fontSize: 10, color: '#64748b' }}>
          {Math.round(recommendation.confidence * 100)}% match
        </span>
      )}
    </div>
  );
};

export default RecommendationCard;
