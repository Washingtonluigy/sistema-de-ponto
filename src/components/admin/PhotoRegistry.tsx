import { useEffect, useState } from 'react';
import { Camera, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase, Profile } from '../../lib/supabase';

type TimeEntry = {
  id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  selfie_url: string | null;
  is_overtime: boolean;
};

type EmployeeWithPhotos = {
  profile: Profile;
  photos: TimeEntry[];
};

export default function PhotoRegistry() {
  const [employees, setEmployees] = useState<EmployeeWithPhotos[]>([]);
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    loadPhotos();
  }, []);

  const loadPhotos = async () => {
    try {
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'employee')
        .order('full_name');

      if (profileError) throw profileError;

      const employeeData: EmployeeWithPhotos[] = [];

      for (const profile of profiles || []) {
        const { data: entries } = await supabase
          .from('time_entries')
          .select('id, user_id, clock_in, clock_out, selfie_url, is_overtime')
          .eq('user_id', profile.id)
          .not('selfie_url', 'is', null)
          .order('clock_in', { ascending: false })
          .limit(50);

        if (entries && entries.length > 0) {
          employeeData.push({
            profile,
            photos: entries,
          });
        }
      }

      setEmployees(employeeData);
    } catch (error) {
      console.error('Error loading photos:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleEmployee = (employeeId: string) => {
    setExpandedEmployee(expandedEmployee === employeeId ? null : employeeId);
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Registro de Fotos EPIs</h2>
        <p className="text-gray-600">Visualize as fotos tiradas pelos colaboradores ao bater ponto</p>
      </div>

      {employees.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <Camera className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Nenhuma foto registrada ainda</p>
        </div>
      ) : (
        <div className="space-y-4">
          {employees.map((emp) => (
            <div key={emp.profile.id} className="bg-white rounded-xl shadow-lg overflow-hidden">
              <button
                onClick={() => toggleEmployee(emp.profile.id)}
                className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                    {emp.profile.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-gray-800 text-lg">{emp.profile.full_name}</p>
                    <p className="text-sm text-gray-600">{emp.profile.job_position || 'Colaborador'}</p>
                    <p className="text-xs text-amber-600 mt-1">{emp.photos.length} fotos registradas</p>
                  </div>
                </div>
                {expandedEmployee === emp.profile.id ? (
                  <ChevronUp className="w-6 h-6 text-gray-400" />
                ) : (
                  <ChevronDown className="w-6 h-6 text-gray-400" />
                )}
              </button>

              {expandedEmployee === emp.profile.id && (
                <div className="border-t border-gray-200 p-6 bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {emp.photos.map((entry) => (
                      <div
                        key={entry.id}
                        className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition cursor-pointer"
                        onClick={() => setSelectedPhoto(entry.selfie_url)}
                      >
                        <div className="aspect-square bg-gray-100 relative">
                          {entry.selfie_url && (
                            <img
                              src={entry.selfie_url}
                              alt="Selfie EPI"
                              className="w-full h-full object-cover"
                            />
                          )}
                          {entry.is_overtime && (
                            <div className="absolute top-2 right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
                              Hora Extra
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="text-xs font-semibold text-gray-700">
                            Entrada: {formatDateTime(entry.clock_in)}
                          </p>
                          {entry.clock_out && (
                            <p className="text-xs text-gray-600 mt-1">
                              Saída: {formatDateTime(entry.clock_out)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="max-w-4xl max-h-[90vh] relative">
            <img
              src={selectedPhoto}
              alt="Selfie EPI Ampliada"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 bg-white text-gray-800 rounded-full w-10 h-10 flex items-center justify-center hover:bg-gray-100 transition"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
