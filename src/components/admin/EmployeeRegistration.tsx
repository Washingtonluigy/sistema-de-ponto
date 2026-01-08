import { useState, useEffect } from 'react';
import { UserPlus, Upload, X, Edit2, Camera } from 'lucide-react';
import { supabase, Profile } from '../../lib/supabase';

export default function EmployeeRegistration() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    phone: '',
    job_position: '',
    work_hours: 8,
    overtime_limit: 30,
    photo_url: '',
    horario_entrada: '08:00',
    horario_saida_almoco: '12:00',
    horario_volta_almoco: '13:00',
    horario_saida: '17:00',
  });

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'employee')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEmployees(data || []);
    } catch (err: any) {
      console.error('Error loading employees:', err);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadPhoto = async (file: File, userId: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('employee-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('employee-photos')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (err) {
      console.error('Error uploading photo:', err);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      if (editingId) {
        let photoUrl = formData.photo_url;
        if (photoFile) {
          const uploadedUrl = await uploadPhoto(photoFile, editingId);
          if (uploadedUrl) photoUrl = uploadedUrl;
        }

        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            full_name: formData.full_name,
            phone: formData.phone,
            job_position: formData.job_position,
            work_hours: formData.work_hours,
            overtime_limit: formData.overtime_limit,
            photo_url: photoUrl,
            horario_entrada: formData.horario_entrada,
            horario_saida_almoco: formData.horario_saida_almoco,
            horario_volta_almoco: formData.horario_volta_almoco,
            horario_saida: formData.horario_saida,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);

        if (updateError) throw updateError;

        setSuccess(true);
        setEditingId(null);
      } else {
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-employee`;

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            full_name: formData.full_name,
            phone: formData.phone,
            job_position: formData.job_position,
            work_hours: formData.work_hours,
            overtime_limit: formData.overtime_limit,
            photo_url: null,
            horario_entrada: formData.horario_entrada,
            horario_saida_almoco: formData.horario_saida_almoco,
            horario_volta_almoco: formData.horario_volta_almoco,
            horario_saida: formData.horario_saida,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Erro ao cadastrar colaborador');
        }

        if (photoFile && result.userId) {
          const uploadedUrl = await uploadPhoto(photoFile, result.userId);
          if (uploadedUrl) {
            await supabase
              .from('profiles')
              .update({ photo_url: uploadedUrl })
              .eq('id', result.userId);
          }
        }

        setSuccess(true);
      }

      setFormData({
        full_name: '',
        email: '',
        password: '',
        phone: '',
        job_position: '',
        work_hours: 8,
        overtime_limit: 30,
        photo_url: '',
        horario_entrada: '08:00',
        horario_saida_almoco: '12:00',
        horario_volta_almoco: '13:00',
        horario_saida: '17:00',
      });
      setPhotoFile(null);
      setPhotoPreview('');
      loadEmployees();

      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar colaborador');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (employee: Profile) => {
    setEditingId(employee.id);
    setFormData({
      full_name: employee.full_name,
      email: '',
      password: '',
      phone: employee.phone || '',
      job_position: employee.job_position || '',
      work_hours: employee.work_hours || 8,
      overtime_limit: employee.overtime_limit || 30,
      photo_url: employee.photo_url || '',
      horario_entrada: employee.horario_entrada || '08:00',
      horario_saida_almoco: employee.horario_saida_almoco || '12:00',
      horario_volta_almoco: employee.horario_volta_almoco || '13:00',
      horario_saida: employee.horario_saida || '17:00',
    });
    setPhotoPreview(employee.photo_url || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({
      full_name: '',
      email: '',
      password: '',
      phone: '',
      job_position: '',
      work_hours: 8,
      overtime_limit: 30,
      photo_url: '',
      horario_entrada: '08:00',
      horario_saida_almoco: '12:00',
      horario_volta_almoco: '13:00',
      horario_saida: '17:00',
    });
    setPhotoFile(null);
    setPhotoPreview('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          {editingId ? 'Editar Colaborador' : 'Cadastrar Colaborador'}
        </h2>
        <p className="text-gray-600">
          {editingId ? 'Atualize as informações do colaborador' : 'Adicione um novo colaborador ao sistema'}
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-8 max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome Completo *
              </label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
                placeholder="João Silva"
                required
              />
            </div>

            {!editingId && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
                    placeholder="joao@email.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Senha *
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Telefone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
                placeholder="(00) 00000-0000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Função
              </label>
              <input
                type="text"
                value={formData.job_position}
                onChange={(e) => setFormData({ ...formData, job_position: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
                placeholder="Técnico de Instalação"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Horas de Trabalho Diárias *
              </label>
              <input
                type="number"
                value={formData.work_hours}
                onChange={(e) => setFormData({ ...formData, work_hours: parseInt(e.target.value) })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
                min="1"
                max="12"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Limite de Horas Extras (h/mês) *
              </label>
              <input
                type="number"
                value={formData.overtime_limit}
                onChange={(e) => setFormData({ ...formData, overtime_limit: parseInt(e.target.value) })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
                min="0"
                max="100"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Horas extras até este limite. Excedente vai para banco de horas.</p>
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Horários de Trabalho</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Horário de Entrada *
                </label>
                <input
                  type="time"
                  value={formData.horario_entrada}
                  onChange={(e) => setFormData({ ...formData, horario_entrada: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Saída para Almoço *
                </label>
                <input
                  type="time"
                  value={formData.horario_saida_almoco}
                  onChange={(e) => setFormData({ ...formData, horario_saida_almoco: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Volta do Almoço *
                </label>
                <input
                  type="time"
                  value={formData.horario_volta_almoco}
                  onChange={(e) => setFormData({ ...formData, horario_volta_almoco: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Horário de Saída *
                </label>
                <input
                  type="time"
                  value={formData.horario_saida}
                  onChange={(e) => setFormData({ ...formData, horario_saida: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Foto do Colaborador (opcional)
            </label>
            <div className="flex items-center space-x-4">
              {photoPreview && (
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="w-16 h-16 rounded-full object-cover"
                />
              )}
              <label className="flex-1 flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-amber-500 transition">
                <Camera className="w-5 h-5 text-gray-400 mr-2" />
                <span className="text-gray-600">Selecionar Foto</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError('')} className="text-red-800 hover:text-red-900">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {success && (
            <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
              <span>Colaborador cadastrado com sucesso!</span>
              <button onClick={() => setSuccess(false)} className="text-green-800 hover:text-green-900">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex space-x-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 text-white py-3 rounded-lg font-semibold hover:from-amber-600 hover:to-orange-700 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {editingId ? <Edit2 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
              <span>{loading ? 'Salvando...' : editingId ? 'Atualizar' : 'Cadastrar'}</span>
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-8">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Colaboradores Cadastrados</h3>
        {employees.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Nenhum colaborador cadastrado</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {employees.map((employee) => (
              <div
                key={employee.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
              >
                <div className="flex items-center space-x-3 mb-3">
                  {employee.photo_url ? (
                    <img
                      src={employee.photo_url}
                      alt={employee.full_name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {employee.full_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">{employee.full_name}</p>
                    <p className="text-sm text-gray-600">{employee.job_position || 'Colaborador'}</p>
                  </div>
                </div>
                <div className="space-y-1 text-sm text-gray-600 mb-3">
                  {employee.phone && <p>Tel: {employee.phone}</p>}
                  <p>Horas: {employee.work_hours}h/dia</p>
                </div>
                <button
                  onClick={() => handleEdit(employee)}
                  className="w-full bg-amber-50 text-amber-700 py-2 rounded-lg font-medium hover:bg-amber-100 transition flex items-center justify-center space-x-2"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Editar</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
