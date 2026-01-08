import { useEffect, useState, useRef } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { supabase, ActiveSession, Profile } from '../../lib/supabase';
import mapboxgl from 'mapbox-gl';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1IjoibWFwaW5oYXMiLCJhIjoiY21naTh4M2VxMDZwODJzcHF3bGttdWl1diJ9.u29rHUnVjbfTPbgmNWW_cw';
mapboxgl.accessToken = MAPBOX_TOKEN;

type ActiveUserWithProfile = ActiveSession & {
  profile: Profile;
};

type EmployeeWithStatus = Profile & {
  is_active: boolean;
  last_location?: { lat: number; lng: number };
};

export default function EmployeeTracking() {
  const [employees, setEmployees] = useState<EmployeeWithStatus[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<{ [key: string]: mapboxgl.Marker }>({});

  useEffect(() => {
    loadActiveUsers();
    const interval = setInterval(loadActiveUsers, 10000);

    return () => {
      clearInterval(interval);
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    if (!MAPBOX_TOKEN) {
      setError('Token do Mapbox não configurado');
      return;
    }

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-56.0974, -15.6014],
        zoom: 6,
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      map.current.on('error', (e: any) => {
        console.error('Mapbox error:', e);
        setError(`Erro no mapa: ${e.error?.message || 'Desconhecido'}`);
      });
    } catch (err: any) {
      console.error('Map initialization error:', err);
      setError(`Erro ao inicializar: ${err.message}`);
    }
  }, [mapContainer.current]);

  const loadActiveUsers = async () => {
    try {
      const [profilesRes, sessionsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'employee'),
        supabase.from('active_sessions').select('*'),
      ]);

      if (profilesRes.error) throw profilesRes.error;

      const allEmployees = profilesRes.data || [];
      const activeSessions = sessionsRes.data || [];

      const employeesWithStatus: EmployeeWithStatus[] = allEmployees.map((emp) => {
        const session = activeSessions.find((s) => s.user_id === emp.id);
        return {
          ...emp,
          is_active: !!session,
          last_location: session?.current_lat && session?.current_lng
            ? { lat: session.current_lat, lng: session.current_lng }
            : undefined,
        };
      });

      setEmployees(employeesWithStatus);
      updateMarkers(employeesWithStatus);
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateMarkers = (emps: EmployeeWithStatus[]) => {
    if (!map.current) return;

    Object.values(markers.current).forEach((marker) => marker.remove());
    markers.current = {};

    emps.forEach((emp) => {
      if (emp.last_location && emp.is_active && map.current) {
        const el = document.createElement('div');
        el.className = 'custom-marker';
        el.innerHTML = `
          <div style="
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            border: 3px solid white;
            box-shadow: 0 4px 6px rgba(0,0,0,0.2);
            cursor: pointer;
          ">
            ${emp.full_name?.charAt(0).toUpperCase()}
          </div>
        `;

        const marker = new mapboxgl.Marker(el)
          .setLngLat([emp.last_location.lng, emp.last_location.lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(
              `<div style="padding: 8px;">
                <strong>${emp.full_name}</strong><br/>
                <small>${emp.job_position || 'Colaborador'}</small><br/>
                <span style="color: #10b981;">Ativo</span>
              </div>`
            )
          )
          .addTo(map.current);

        markers.current[emp.id] = marker;

        el.addEventListener('click', () => {
          setSelectedUser(emp.id);
        });
      }
    });
  };

  const flyToUser = (emp: EmployeeWithStatus) => {
    if (emp.is_active && emp.last_location && map.current) {
      map.current.flyTo({
        center: [emp.last_location.lng, emp.last_location.lat],
        zoom: 15,
        duration: 2000,
      });
      setSelectedUser(emp.id);
      markers.current[emp.id]?.togglePopup();
    } else if (!emp.is_active) {
      alert('Este colaborador não está ativo no momento.');
    } else if (!emp.last_location) {
      alert('Localização do colaborador não disponível.');
    }
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
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Acompanhar Colaboradores</h2>
        <p className="text-gray-600">Localização em tempo real dos colaboradores ativos</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="font-semibold">Erro no Mapa</p>
          <p className="text-sm">{error}</p>
          <p className="text-xs mt-2">Token configurado: {MAPBOX_TOKEN ? 'Sim' : 'Não'}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-lg overflow-hidden" style={{ height: '600px' }}>
          <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
            <MapPin className="w-5 h-5 mr-2 text-amber-600" />
            Todos Colaboradores
          </h3>

          {employees.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Nenhum colaborador cadastrado</p>
          ) : (
            <div className="space-y-3 max-h-[520px] overflow-y-auto">
              {employees.map((emp) => (
                <div
                  key={emp.id}
                  onClick={() => flyToUser(emp)}
                  className={`p-4 rounded-lg transition cursor-pointer ${
                    selectedUser === emp.id
                      ? 'bg-amber-50 border-2 border-amber-500'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
                        emp.is_active
                          ? 'bg-gradient-to-br from-green-500 to-emerald-600'
                          : 'bg-gradient-to-br from-red-500 to-red-600'
                      }`}>
                        {emp.full_name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">
                          {emp.full_name}
                        </p>
                        <p className="text-xs text-gray-600">{emp.job_position || 'Colaborador'}</p>
                      </div>
                    </div>
                    {emp.is_active && <Navigation className="w-4 h-4 text-amber-600" />}
                  </div>
                  <div className="text-xs space-y-1">
                    <p className="flex items-center">
                      <span className={`w-2 h-2 rounded-full mr-2 ${
                        emp.is_active ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                      }`}></span>
                      <span className={emp.is_active ? 'text-green-600' : 'text-red-600'}>
                        {emp.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
