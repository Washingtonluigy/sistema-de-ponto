import { useState, useEffect } from 'react';
import { Car, Plus, Edit2, Trash2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Modal from '../Modal';

interface Vehicle {
  id: string;
  name: string;
  plate: string;
  initial_mileage: number;
  current_mileage: number;
  status: 'active' | 'maintenance' | 'inactive';
  created_at: string;
}

export default function VehicleManagement() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    plate: '',
    initial_mileage: 0,
    status: 'active' as 'active' | 'maintenance' | 'inactive'
  });

  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVehicles(data || []);
    } catch (err) {
      console.error('Error loading vehicles:', err);
      setError('Erro ao carregar veículos');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (editingVehicle) {
        const { error } = await supabase
          .from('vehicles')
          .update({
            name: formData.name,
            plate: formData.plate.toUpperCase(),
            status: formData.status
          })
          .eq('id', editingVehicle.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('vehicles')
          .insert({
            name: formData.name,
            plate: formData.plate.toUpperCase(),
            initial_mileage: formData.initial_mileage,
            current_mileage: formData.initial_mileage,
            status: formData.status
          });

        if (error) throw error;
      }

      setShowModal(false);
      setEditingVehicle(null);
      setFormData({ name: '', plate: '', initial_mileage: 0, status: 'active' });
      loadVehicles();
    } catch (err: any) {
      console.error('Error saving vehicle:', err);
      setError(err.message || 'Erro ao salvar veículo');
    }
  };

  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      name: vehicle.name,
      plate: vehicle.plate,
      initial_mileage: vehicle.initial_mileage,
      status: vehicle.status
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este veículo?')) return;

    try {
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadVehicles();
    } catch (err) {
      console.error('Error deleting vehicle:', err);
      alert('Erro ao excluir veículo');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'maintenance': return 'bg-yellow-100 text-yellow-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'maintenance': return 'Manutenção';
      case 'inactive': return 'Inativo';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gerenciar Veículos</h2>
          <p className="text-gray-600 mt-1">Cadastre e gerencie os veículos da empresa</p>
        </div>
        <button
          onClick={() => {
            setEditingVehicle(null);
            setFormData({ name: '', plate: '', initial_mileage: 0, status: 'active' });
            setShowModal(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>Novo Veículo</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center space-x-2">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {vehicles.map((vehicle) => (
          <div key={vehicle.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4">
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center space-x-3">
                  <Car className="w-8 h-8" />
                  <div>
                    <h3 className="font-bold text-lg">{vehicle.name}</h3>
                    <p className="text-sm opacity-90">{vehicle.plate}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(vehicle.status)}`}>
                  {getStatusText(vehicle.status)}
                </span>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500 font-medium">KM Inicial</p>
                  <p className="text-lg font-bold text-gray-900">{vehicle.initial_mileage.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">KM Atual</p>
                  <p className="text-lg font-bold text-blue-600">{vehicle.current_mileage.toLocaleString()}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 font-medium">Total Rodado</p>
                <p className="text-xl font-bold text-green-600">
                  {(vehicle.current_mileage - vehicle.initial_mileage).toLocaleString()} km
                </p>
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  onClick={() => handleEdit(vehicle)}
                  className="flex-1 bg-blue-50 text-blue-600 py-2 rounded-lg hover:bg-blue-100 transition flex items-center justify-center space-x-1"
                >
                  <Edit2 className="w-4 h-4" />
                  <span className="text-sm font-medium">Editar</span>
                </button>
                <button
                  onClick={() => handleDelete(vehicle.id)}
                  className="flex-1 bg-red-50 text-red-600 py-2 rounded-lg hover:bg-red-100 transition flex items-center justify-center space-x-1"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="text-sm font-medium">Excluir</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {vehicles.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <Car className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum veículo cadastrado</h3>
          <p className="text-gray-600 mb-4">Comece adicionando o primeiro veículo da empresa</p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Adicionar Veículo
          </button>
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)}>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {editingVehicle ? 'Editar Veículo' : 'Novo Veículo'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nome/Modelo do Veículo *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ex: Fiat Uno 2020"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Placa *
            </label>
            <input
              type="text"
              required
              value={formData.plate}
              onChange={(e) => setFormData({ ...formData, plate: e.target.value.toUpperCase() })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
              placeholder="Ex: ABC-1234"
              maxLength={8}
            />
          </div>

          {!editingVehicle && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quilometragem Inicial *
              </label>
              <input
                type="number"
                required
                min="0"
                value={formData.initial_mileage}
                onChange={(e) => setFormData({ ...formData, initial_mileage: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: 50000"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status *
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="active">Ativo</option>
              <option value="maintenance">Em Manutenção</option>
              <option value="inactive">Inativo</option>
            </select>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              {editingVehicle ? 'Salvar' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
