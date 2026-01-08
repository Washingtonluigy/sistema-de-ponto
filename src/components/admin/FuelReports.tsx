import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, DollarSign, Fuel, Calendar, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Vehicle {
  id: string;
  name: string;
  plate: string;
}

interface FuelRecord {
  id: string;
  vehicle_id: string;
  date: string;
  mileage: number;
  liters: number;
  price_per_liter: number;
  total_value: number;
  gas_station: string;
  location: string;
}

interface VehicleStats {
  vehicle_name: string;
  vehicle_plate: string;
  total_records: number;
  total_liters: number;
  total_spent: number;
  total_km: number;
  avg_consumption: number;
  avg_price: number;
  stations: { [key: string]: number };
}

export default function FuelReports() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<VehicleStats[]>([]);

  useEffect(() => {
    loadVehicles();
  }, []);

  useEffect(() => {
    if (vehicles.length > 0) {
      loadStats();
    }
  }, [selectedVehicle, startDate, endDate, vehicles]);

  const loadVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, name, plate')
        .order('name');

      if (error) throw error;
      setVehicles(data || []);
    } catch (err) {
      console.error('Error loading vehicles:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('fuel_records')
        .select('*, vehicles(name, plate, initial_mileage, current_mileage)');

      if (selectedVehicle !== 'all') {
        query = query.eq('vehicle_id', selectedVehicle);
      }

      if (startDate) {
        query = query.gte('date', new Date(startDate).toISOString());
      }

      if (endDate) {
        query = query.lte('date', new Date(endDate + 'T23:59:59').toISOString());
      }

      const { data: records, error } = await query.order('date', { ascending: false });

      if (error) throw error;

      const vehicleMap: { [key: string]: VehicleStats } = {};

      records?.forEach((record: any) => {
        const vehicleId = record.vehicle_id;

        if (!vehicleMap[vehicleId]) {
          vehicleMap[vehicleId] = {
            vehicle_name: record.vehicles.name,
            vehicle_plate: record.vehicles.plate,
            total_records: 0,
            total_liters: 0,
            total_spent: 0,
            total_km: record.vehicles.current_mileage - record.vehicles.initial_mileage,
            avg_consumption: 0,
            avg_price: 0,
            stations: {}
          };
        }

        const stats = vehicleMap[vehicleId];
        stats.total_records++;
        stats.total_liters += parseFloat(record.liters);
        stats.total_spent += parseFloat(record.total_value);

        if (!stats.stations[record.gas_station]) {
          stats.stations[record.gas_station] = 0;
        }
        stats.stations[record.gas_station]++;
      });

      Object.values(vehicleMap).forEach(stats => {
        if (stats.total_liters > 0 && stats.total_km > 0) {
          stats.avg_consumption = stats.total_km / stats.total_liters;
        }
        if (stats.total_records > 0) {
          stats.avg_price = stats.total_spent / stats.total_liters;
        }
      });

      setStats(Object.values(vehicleMap));
    } catch (err) {
      console.error('Error loading stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalSpent = stats.reduce((sum, s) => sum + s.total_spent, 0);
  const totalLiters = stats.reduce((sum, s) => sum + s.total_liters, 0);
  const totalRecords = stats.reduce((sum, s) => sum + s.total_records, 0);
  const avgPrice = totalLiters > 0 ? totalSpent / totalLiters : 0;

  const allStations: { [key: string]: number } = {};
  stats.forEach(s => {
    Object.entries(s.stations).forEach(([station, count]) => {
      allStations[station] = (allStations[station] || 0) + count;
    });
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Relatórios de Combustível</h2>
        <p className="text-gray-600 mt-1">Análise detalhada de consumo e gastos</p>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Veículo
            </label>
            <select
              value={selectedVehicle}
              onChange={(e) => setSelectedVehicle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos os Veículos</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.name} - {vehicle.plate}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data Inicial
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data Final
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <BarChart3 className="w-8 h-8 opacity-80" />
            <span className="text-sm opacity-80">Total</span>
          </div>
          <p className="text-3xl font-bold">{totalRecords}</p>
          <p className="text-sm opacity-90 mt-1">Abastecimentos</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 opacity-80" />
            <span className="text-sm opacity-80">Gastos</span>
          </div>
          <p className="text-3xl font-bold">R$ {totalSpent.toFixed(2)}</p>
          <p className="text-sm opacity-90 mt-1">Total Investido</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <Fuel className="w-8 h-8 opacity-80" />
            <span className="text-sm opacity-80">Volume</span>
          </div>
          <p className="text-3xl font-bold">{totalLiters.toFixed(0)}L</p>
          <p className="text-sm opacity-90 mt-1">Total Abastecido</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-8 h-8 opacity-80" />
            <span className="text-sm opacity-80">Média</span>
          </div>
          <p className="text-3xl font-bold">R$ {avgPrice.toFixed(2)}</p>
          <p className="text-sm opacity-90 mt-1">Preço Médio/Litro</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            <span>Postos Mais Utilizados</span>
          </h3>
          <div className="space-y-3">
            {Object.entries(allStations)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 10)
              .map(([station, count]) => (
                <div key={station} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Fuel className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{station}</p>
                      <p className="text-sm text-gray-500">{count} abastecimentos</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-blue-600">
                      {((count / totalRecords) * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
              ))}
          </div>

          {Object.keys(allStations).length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum posto registrado</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-green-600" />
            <span>Análise por Veículo</span>
          </h3>
          <div className="space-y-4">
            {stats.map((vehicleStats) => (
              <div key={vehicleStats.vehicle_plate} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-gray-900">{vehicleStats.vehicle_name}</h4>
                    <p className="text-sm text-gray-500">{vehicleStats.vehicle_plate}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-600">
                      R$ {vehicleStats.total_spent.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">{vehicleStats.total_records} registros</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-100">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Total KM</p>
                    <p className="text-sm font-bold text-gray-900">{vehicleStats.total_km.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Litros</p>
                    <p className="text-sm font-bold text-gray-900">{vehicleStats.total_liters.toFixed(0)}L</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Média km/L</p>
                    <p className="text-sm font-bold text-blue-600">
                      {vehicleStats.avg_consumption.toFixed(1)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {stats.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum dado disponível</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
