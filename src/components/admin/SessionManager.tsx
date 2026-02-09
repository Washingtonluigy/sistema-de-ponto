import { useState, useEffect } from 'react';
import { AlertTriangle, X, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type SessionStatus = {
  user_id: string;
  full_name: string;
  clock_in_time: string;
  last_updated: string;
  has_entry: boolean;
  is_orphan: boolean;
};

export default function SessionManager() {
  const [sessions, setSessions] = useState<SessionStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const { data: activeSessions } = await supabase
        .from('active_sessions')
        .select('user_id, clock_in_time, last_updated');

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name');

      const sessionStatus: SessionStatus[] = [];

      for (const session of activeSessions || []) {
        const profile = profiles?.find(p => p.id === session.user_id);

        const { data: entry } = await supabase
          .from('time_entries')
          .select('id')
          .eq('user_id', session.user_id)
          .eq('clock_in', session.clock_in_time)
          .is('clock_out', null)
          .maybeSingle();

        sessionStatus.push({
          user_id: session.user_id,
          full_name: profile?.full_name || 'Desconhecido',
          clock_in_time: session.clock_in_time,
          last_updated: session.last_updated,
          has_entry: !!entry,
          is_orphan: !entry,
        });
      }

      setSessions(sessionStatus);
    } catch (error) {
      console.error('Erro ao carregar sessões:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResetSession = async (userId: string, userName: string) => {
    if (!confirm(`Tem certeza que deseja resetar a sessão de ${userName}?`)) {
      return;
    }

    try {
      await supabase.from('active_sessions').delete().eq('user_id', userId);
      alert('Sessão resetada com sucesso!');
      loadSessions();
    } catch (error: any) {
      alert('Erro ao resetar sessão: ' + error.message);
    }
  };

  const handleCleanOrphans = async () => {
    const orphans = sessions.filter(s => s.is_orphan);
    if (orphans.length === 0) {
      alert('Não há sessões órfãs para limpar.');
      return;
    }

    if (!confirm(`Encontradas ${orphans.length} sessões órfãs. Deseja limpar todas?`)) {
      return;
    }

    try {
      for (const orphan of orphans) {
        await supabase.from('active_sessions').delete().eq('user_id', orphan.user_id);
      }
      alert(`${orphans.length} sessões órfãs foram limpas!`);
      loadSessions();
    } catch (error: any) {
      alert('Erro ao limpar sessões: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  const orphanCount = sessions.filter(s => s.is_orphan).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Gerenciar Sessões Ativas</h2>
          <p className="text-gray-600">Diagnosticar e resolver problemas de sessões travadas</p>
        </div>
        <button
          onClick={loadSessions}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center space-x-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Atualizar</span>
        </button>
      </div>

      {orphanCount > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-6 h-6 text-red-600 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800">
                  {orphanCount} {orphanCount === 1 ? 'Sessão Órfã Detectada' : 'Sessões Órfãs Detectadas'}
                </p>
                <p className="text-sm text-red-700 mt-1">
                  Estas sessões estão ativas mas sem entrada correspondente no banco.
                  Isso impede os colaboradores de bater ponto.
                </p>
              </div>
            </div>
            <button
              onClick={handleCleanOrphans}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm"
            >
              Limpar Todas
            </button>
          </div>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <p className="text-gray-600">Nenhuma sessão ativa no momento</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Colaborador</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Entrada</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Última Atualização</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sessions.map((session) => (
                <tr key={session.user_id} className={session.is_orphan ? 'bg-red-50' : 'hover:bg-gray-50'}>
                  <td className="px-4 py-3 text-sm text-gray-800 font-medium">{session.full_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(session.clock_in_time).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(session.last_updated).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {session.is_orphan ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Órfã (Sem Entrada)
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        OK
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <button
                      onClick={() => handleResetSession(session.user_id, session.full_name)}
                      className="text-red-600 hover:text-red-800 font-medium flex items-center space-x-1"
                    >
                      <X className="w-4 h-4" />
                      <span>Resetar</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
