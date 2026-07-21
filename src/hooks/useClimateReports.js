import { useCallback, useEffect, useState } from 'react';
import { reports as fallbackReports } from '../utils/climafyData.js';
import { reportsAPI, unwrap } from '../services/api.js';

const normalizeReports = (payload) => {
  const items = Array.isArray(payload) ? payload : payload?.reports ?? payload?.items ?? [];

  return items.map((report, index) => ({
    id: report.id ?? report._id ?? index + 1,
    category: report.category ?? report.type ?? 'Alagamento',
    neighborhood: report.neighborhood?.name ?? report.neighborhood ?? report.bairro ?? 'Bairro',
    title: report.title ?? report.titulo ?? 'Relato da comunidade',
    description: report.description ?? report.descricao ?? report.summary ?? '',
    status: report.status ?? 'Aberto',
    time: report.time ?? report.createdAgo ?? report.created_at ?? 'Agora',
    votes: report.votes ?? report.upvotes ?? 0,
    tone: report.tone ?? report.categoryTone ?? 'blue',
    color: report.color,
    period: report.period ?? '7 dias',
  }));
};

export function useClimateReports(params = {}) {
  const [reports, setReports] = useState(fallbackReports);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = unwrap(await reportsAPI.list(params));
      const nextReports = normalizeReports(data);
      setReports(nextReports.length ? nextReports : fallbackReports);
    } catch {
      setReports(fallbackReports);
      setError('Nao foi possivel carregar os relatos do backend. Exibindo dados mockados.');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(params)]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  return {
    reports,
    totalReports: reports.length,
    loading,
    error,
    retry: loadReports,
  };
}
