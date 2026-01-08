import { useState, useEffect } from 'react';
import { Fuel, Plus, Image as ImageIcon, AlertCircle, Calendar, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Modal from '../Modal';

interface Vehicle {
  id: string;
  name: string;
  plate: string;
  current_mileage: number;
}

interface FuelRecord {
  id: string;
  vehicle_id: string;
  employee_id: string;
  date: string;
  mileage: number;
  liters: number;
  price_per_liter: number;
  total_value: number;
  gas_station: string;
  location: string;
  receipt_url: string | null;
  notes: string | null;
  vehicles: {
    name: string;
    plate: string;
  };
  profiles: {
    full_name: string;
  };
}

export default function FuelManagement() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [fuelRecords, setFuelRecords] = useState<FuelRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    vehicle_id: '',
    date: new Date().toISOString().split('T')[0],
    mileage: 0,
    liters: 0,
    price_per_liter: 0,
    gas_station: '',
    location: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [vehiclesRes, recordsRes] = await Promise.all([
        supabase.from('vehicles').select('*').eq('status', 'active').order('name'),
        supabase
          .from('fuel_records')
          .select(`
            *,
            vehicles(name, plate),
            profiles(full_name)
          `)
          .order('date', { ascending: false })
          .limit(50)
      ]);

      if (vehiclesRes.error) throw vehiclesRes.error;
      if (recordsRes.error) throw recordsRes.error;

      setVehicles(vehiclesRes.data || []);
      setFuelRecords(recordsRes.data || []);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const uploadReceipt = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('fuel-receipts')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    return filePath;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      let receiptUrl = null;
      if (receiptFile) {
        receiptUrl = await uploadReceipt(receiptFile);
      }

      const totalValue = formData.liters * formData.price_per_liter;

      const { error } = await supabase.from('fuel_records').insert({
        vehicle_id: formData.vehicle_id,
        employee_id: user.id,
        date: new Date(formData.date).toISOString(),
        mileage: formData.mileage,
        liters: formData.liters,
        price_per_liter: formData.price_per_liter,
        total_value: totalValue,
        gas_station: formData.gas_station,
        location: formData.location,
        receipt_url: receiptUrl,
        notes: formData.notes || null
      });

      if (error) throw error;

      setShowModal(false);
      resetForm();
      loadData();
    } catch (err: any) {
      console.error('Error saving fuel record:', err);
      setError(err.message || 'Erro ao salvar abastecimento');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      vehicle_id: '',
      date: new Date().toISOString().split('T')[0],
      mileage: 0,
      liters: 0,
      price_per_liter: 0,
      gas_station: '',
      location: '',
      notes: ''
    });
    setReceiptFile(null);
    setPreviewUrl(null);
  };

  const viewReceipt = async (receiptUrl: string) => {
    try {
      const { data } = await supabase.storage
        .from('fuel-receipts')
        .createSignedUrl(receiptUrl, 3600);

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err) {
      console.error('Error viewing receipt:', err);
      alert('Erro ao visualizar comprovante');
    }
  };

  const totalValue = formData.liters * formData.price_per_liter;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Controle de Combustível</h2>
          <p className="text-gray-600 mt-1">Registre todos os abastecimentos dos veículos</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          disabled={vehicles.length === 0}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-5 h-5" />
          <span>Novo Abastecimento</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center space-x-2">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {vehicles.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
          <p className="font-medium">Cadastre um veículo antes de registrar abastecimentos</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Veículo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">KM</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Litros</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">R$/L</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Posto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Comprovante</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {fuelRecords.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(record.date).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{record.vehicles.name}</p>
                      <p className="text-xs text-gray-500">{record.vehicles.plate}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {record.mileage.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {record.liters.toFixed(2)}L
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    R$ {record.price_per_liter.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                    R$ {record.total_value.toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm text-gray-900">{record.gas_station}</p>
                      <p className="text-xs text-gray-500">{record.location}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {record.receipt_url ? (
                      <button
                        onClick={() => viewReceipt(record.receipt_url!)}
                        className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                      >
                        <ImageIcon className="w-4 h-4" />
                        <span className="text-sm">Ver</span>
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">Sem comprovante</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {fuelRecords.length === 0 && (
            <div className="text-center py-12">
              <Fuel className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum abastecimento registrado</h3>
              <p className="text-gray-600">Comece adicionando o primeiro abastecimento</p>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)}>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Novo Abastecimento</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Veículo *
              </label>
              <select
                required
                value={formData.vehicle_id}
                onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">Selecione um veículo</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.name} - {vehicle.plate} (KM atual: {vehicle.current_mileage})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data *
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quilometragem *
              </label>
              <input
                type="number"
                required
                min="0"
                value={formData.mileage || ''}
                onChange={(e) => setFormData({ ...formData, mileage: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Ex: 50000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Litros *
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.liters || ''}
                onChange={(e) => setFormData({ ...formData, liters: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Ex: 40.50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preço por Litro *
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.price_per_liter || ''}
                onChange={(e) => setFormData({ ...formData, price_per_liter: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Ex: 5.49"
              />
            </div>

            {totalValue > 0 && (
              <div className="col-span-2 bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-700 mb-1">Valor Total</p>
                <p className="text-3xl font-bold text-green-600">R$ {totalValue.toFixed(2)}</p>
              </div>
            )}

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Posto de Combustível *
              </label>
              <input
                type="text"
                required
                value={formData.gas_station}
                onChange={(e) => setFormData({ ...formData, gas_station: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Ex: Shell, Ipiranga, Petrobras"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Localização *
              </label>
              <input
                type="text"
                required
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Ex: Rodovia BR-101, km 230"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Comprovante/Nota Fiscal
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              {previewUrl && (
                <div className="mt-2">
                  <img src={previewUrl} alt="Preview" className="h-32 rounded-lg object-cover" />
                </div>
              )}
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observações
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Informações adicionais..."
              />
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              disabled={uploading}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
            >
              {uploading ? 'Salvando...' : 'Salvar Abastecimento'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
