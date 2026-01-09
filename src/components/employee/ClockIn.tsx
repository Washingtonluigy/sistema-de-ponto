import { useState, useRef, useEffect } from 'react';
import { Clock, Camera, MapPin, CheckCircle, WifiOff, Wifi } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { offlineStorage } from '../../lib/offlineStorage';
import { syncService } from '../../lib/syncService';
import Modal from '../Modal';

export default function ClockIn() {
  const { user, profile } = useAuth();
  const isOnline = useOnlineStatus();
  const [loading, setLoading] = useState(false);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [showEpiModal, setShowEpiModal] = useState(false);
  const [isOvertimeSession, setIsOvertimeSession] = useState(false);
  const [pendingSync, setPendingSync] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    checkActiveSession();
    checkPendingSync();
    syncService.startAutoSync();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [user]);

  useEffect(() => {
    if (isOnline) {
      syncService.syncPendingEntries().then(() => {
        checkPendingSync();
      });
    }
  }, [isOnline]);

  const checkPendingSync = async () => {
    const pending = await offlineStorage.getPendingEntries();
    setPendingSync(pending.length);
  };

  useEffect(() => {
    if (!activeSession) return;

    const interval = setInterval(() => {
      checkAutoClockOut();
    }, 30000);

    return () => clearInterval(interval);
  }, [activeSession, profile]);

  const checkActiveSession = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('active_sessions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    setActiveSession(data);

    if (data) {
      const { data: currentEntry } = await supabase
        .from('time_entries')
        .select('is_overtime')
        .eq('user_id', user.id)
        .is('clock_out', null)
        .order('clock_in', { ascending: false })
        .limit(1)
        .maybeSingle();

      setIsOvertimeSession(currentEntry?.is_overtime || false);
    }
  };

  const getCurrentTimeInMinutes = () => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  };

  const timeStringToMinutes = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const checkAutoClockOut = async () => {
    if (!profile || !activeSession || isOvertimeSession) return;

    const currentMinutes = getCurrentTimeInMinutes();
    const lunchStart = profile.horario_saida_almoco ? timeStringToMinutes(profile.horario_saida_almoco) : null;
    const endTime = profile.horario_saida ? timeStringToMinutes(profile.horario_saida) : null;

    if (lunchStart && Math.abs(currentMinutes - lunchStart) <= 1) {
      await handleAutoClockOut('lunch');
    } else if (endTime && Math.abs(currentMinutes - endTime) <= 1) {
      await handleAutoClockOut('end');
    }
  };

  const handleAutoClockOut = async (reason: 'lunch' | 'end') => {
    try {
      const { data: lastEntry } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', user?.id)
        .is('clock_out', null)
        .order('clock_in', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastEntry) {
        const clockIn = new Date(lastEntry.clock_in);
        const clockOut = new Date();
        const totalHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);

        await supabase
          .from('time_entries')
          .update({
            clock_out: clockOut.toISOString(),
            total_hours: totalHours,
          })
          .eq('id', lastEntry.id);

        await supabase.from('active_sessions').delete().eq('user_id', user?.id);

        await checkActiveSession();

        const message = reason === 'lunch'
          ? 'Saída automática registrada para almoço'
          : 'Saída automática registrada - fim do expediente';

        setModalTitle('Saída Automática');
        setModalMessage(message);
        setModalOpen(true);
      }
    } catch (error: any) {
      console.error('Erro no clock-out automático:', error);
    }
  };

  const isOvertimePeriod = () => {
    if (!profile) return false;

    const currentMinutes = getCurrentTimeInMinutes();
    const lunchStart = profile.horario_saida_almoco ? timeStringToMinutes(profile.horario_saida_almoco) : null;
    const lunchEnd = profile.horario_volta_almoco ? timeStringToMinutes(profile.horario_volta_almoco) : null;
    const endTime = profile.horario_saida ? timeStringToMinutes(profile.horario_saida) : null;

    const isLunchPeriod = lunchStart && lunchEnd && currentMinutes >= lunchStart && currentMinutes < lunchEnd;
    const isAfterHours = endTime && currentMinutes >= endTime;

    return { isOvertime: isLunchPeriod || isAfterHours, type: isLunchPeriod ? 'lunch' : 'after_hours' };
  };

  const startCamera = async () => {
    setCameraError(null);
    setShowCamera(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error: any) {
      let errorMsg = 'Erro ao acessar câmera. ';
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMsg += 'Você precisa permitir o acesso à câmera. Clique no ícone de cadeado na barra de endereço e permita a câmera.';
      } else if (error.name === 'NotFoundError') {
        errorMsg += 'Nenhuma câmera foi encontrada no dispositivo.';
      } else {
        errorMsg += error.message || 'Verifique as permissões.';
      }
      setCameraError(errorMsg);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg');
      setCapturedImage(imageData);
      setShowCamera(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    }
  };

  const getLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalização não suportada pelo navegador'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          let errorMsg = 'Erro ao obter localização: ';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMsg += 'Permissão negada. Clique no ícone ao lado da URL e permita a localização.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMsg += 'Localização indisponível. Tente novamente.';
              break;
            case error.TIMEOUT:
              errorMsg += 'Tempo esgotado. Tente novamente.';
              break;
            default:
              errorMsg += error.message || 'Erro desconhecido';
          }
          reject(new Error(errorMsg));
        },
        {
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 30000
        }
      );
    });
  };

  const handleClockIn = async () => {
    if (!capturedImage) {
      alert('Por favor, tire uma selfie antes de bater o ponto');
      return;
    }

    setLoading(true);
    try {
      let loc = { lat: 0, lng: 0 };
      try {
        loc = await getLocation();
        setLocation(loc);
      } catch (locError: any) {
        console.warn('Localização não disponível:', locError);
      }

      const overtimeCheck = isOvertimePeriod();
      const clockInTime = new Date().toISOString();

      if (!isOnline) {
        const pendingEntry = {
          id: `pending-${Date.now()}`,
          user_id: user!.id,
          clock_in: clockInTime,
          location_lat: loc.lat,
          location_lng: loc.lng,
          selfie_url: capturedImage,
          is_overtime: overtimeCheck.isOvertime,
          overtime_type: overtimeCheck.isOvertime ? overtimeCheck.type : null,
          type: 'clock_in' as const,
          timestamp: Date.now(),
        };

        await offlineStorage.addPendingEntry(pendingEntry);
        await checkPendingSync();
        setCapturedImage(null);

        setActiveSession({
          user_id: user!.id,
          clock_in_time: clockInTime,
          current_lat: loc.lat,
          current_lng: loc.lng,
          last_updated: clockInTime,
        });
        setIsOvertimeSession(overtimeCheck.isOvertime);

        setModalTitle('Ponto Salvo Offline');
        setModalMessage('Seu ponto foi salvo localmente e será enviado quando houver internet.');
        setModalOpen(true);
        return;
      }

      const { data: entry, error: entryError } = await supabase
        .from('time_entries')
        .insert({
          user_id: user?.id,
          clock_in: clockInTime,
          location_lat: loc.lat,
          location_lng: loc.lng,
          selfie_url: capturedImage,
          is_overtime: overtimeCheck.isOvertime,
          overtime_type: overtimeCheck.isOvertime ? overtimeCheck.type : null,
        })
        .select()
        .single();

      if (entryError) throw entryError;

      await supabase.from('active_sessions').upsert({
        user_id: user?.id,
        clock_in_time: clockInTime,
        current_lat: loc.lat,
        current_lng: loc.lng,
        last_updated: new Date().toISOString(),
      });

      await checkActiveSession();
      setCapturedImage(null);

      if (overtimeCheck.isOvertime) {
        setModalTitle('Ponto Batido - Hora Extra');
        setModalMessage(overtimeCheck.type === 'lunch'
          ? 'Você está trabalhando no horário de almoço. Este período será contado como hora extra.'
          : 'Você está trabalhando após o expediente. Este período será contado como hora extra.');
      } else {
        setModalTitle('Ponto Batido');
        setModalMessage('');
      }
      setModalOpen(true);
    } catch (error: any) {
      setModalTitle('Erro');
      setModalMessage('Erro ao bater ponto: ' + error.message);
      setModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    setLoading(true);
    try {
      const clockOutTime = new Date().toISOString();

      if (!isOnline) {
        const pendingEntry = {
          id: `pending-out-${Date.now()}`,
          user_id: user!.id,
          clock_out: clockOutTime,
          location_lat: 0,
          location_lng: 0,
          selfie_url: '',
          is_overtime: false,
          overtime_type: null,
          type: 'clock_out' as const,
          timestamp: Date.now(),
          total_hours: 0,
        };

        await offlineStorage.addPendingEntry(pendingEntry);
        await checkPendingSync();

        setActiveSession(null);

        setModalTitle('Saída Salva Offline');
        setModalMessage('Sua saída foi salva localmente e será enviada quando houver internet.');
        setModalOpen(true);
        return;
      }

      const { data: lastEntry, error: fetchError } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', user?.id)
        .is('clock_out', null)
        .order('clock_in', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        console.error('Erro ao buscar última entrada:', fetchError);
        throw new Error('Erro ao buscar registro de entrada: ' + fetchError.message);
      }

      if (!lastEntry) {
        throw new Error('Nenhuma entrada em aberto encontrada. Por favor, registre uma entrada primeiro.');
      }

      if (lastEntry) {
        const clockIn = new Date(lastEntry.clock_in);
        const clockOut = new Date();
        const totalHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);

        const { error: updateError } = await supabase
          .from('time_entries')
          .update({
            clock_out: clockOut.toISOString(),
            total_hours: totalHours,
          })
          .eq('id', lastEntry.id);

        if (updateError) {
          console.error('Erro ao atualizar registro de saída:', updateError);
          throw new Error('Erro ao registrar saída: ' + updateError.message);
        }

        if (lastEntry.is_overtime) {
          const now = new Date();
          const month = now.getMonth() + 1;
          const year = now.getFullYear();
          const overtimeLimit = profile?.overtime_limit || 30;

          const { data: overtime } = await supabase
            .from('overtime_hours')
            .select('*')
            .eq('user_id', user?.id)
            .eq('month', month)
            .eq('year', year)
            .maybeSingle();

          const currentOvertime = overtime?.overtime_hours || 0;
          const currentHourBank = overtime?.hour_bank || 0;
          const newTotalExtra = currentOvertime + currentHourBank + totalHours;

          const newOvertime = Math.min(newTotalExtra, overtimeLimit);
          const newHourBank = Math.max(0, newTotalExtra - overtimeLimit);

          const { error: overtimeError } = await supabase.from('overtime_hours').upsert({
            user_id: user?.id,
            month,
            year,
            overtime_hours: newOvertime,
            hour_bank: newHourBank,
            updated_at: new Date().toISOString(),
          });

          if (overtimeError) {
            console.error('Erro ao atualizar horas extras:', overtimeError);
          }
        } else {
          const workHours = profile?.work_hours || 8;
          const extraHours = Math.max(0, totalHours - workHours);

          if (extraHours > 0) {
            const now = new Date();
            const month = now.getMonth() + 1;
            const year = now.getFullYear();
            const overtimeLimit = profile?.overtime_limit || 30;

            const { data: overtime } = await supabase
              .from('overtime_hours')
              .select('*')
              .eq('user_id', user?.id)
              .eq('month', month)
              .eq('year', year)
              .maybeSingle();

            const currentOvertime = overtime?.overtime_hours || 0;
            const currentHourBank = overtime?.hour_bank || 0;
            const newTotalExtra = currentOvertime + currentHourBank + extraHours;

            const newOvertime = Math.min(newTotalExtra, overtimeLimit);
            const newHourBank = Math.max(0, newTotalExtra - overtimeLimit);

            const { error: overtimeError2 } = await supabase.from('overtime_hours').upsert({
              user_id: user?.id,
              month,
              year,
              overtime_hours: newOvertime,
              hour_bank: newHourBank,
              updated_at: new Date().toISOString(),
            });

            if (overtimeError2) {
              console.error('Erro ao atualizar horas extras:', overtimeError2);
            }
          }
        }

        const { error: deleteError } = await supabase.from('active_sessions').delete().eq('user_id', user?.id);

        if (deleteError) {
          console.error('Erro ao deletar sessão ativa:', deleteError);
        }

        await checkActiveSession();
        setModalTitle('Saída Registrada');
        setModalMessage('Sua saída foi registrada com sucesso!');
        setModalOpen(true);
      }
    } catch (error: any) {
      console.error('Erro completo ao registrar saída:', error);
      setModalTitle('Erro ao Registrar Saída');
      setModalMessage(error.message || 'Ocorreu um erro desconhecido. Por favor, tente novamente.');
      setModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  if (showCamera) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Bater Ponto</h2>
          <p className="text-gray-600">Tire uma selfie com o EPI</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
            <Camera className="w-5 h-5 mr-2 text-amber-600" />
            Posicione-se na câmera
          </h3>
          <div className="space-y-4">
            {cameraError ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
                <p className="font-medium mb-2">Erro ao acessar câmera</p>
                <p className="text-sm">{cameraError}</p>
              </div>
            ) : (
              <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 pointer-events-none">
                  <p className="text-white text-sm">Carregando câmera...</p>
                </div>
              </div>
            )}
            <div className="flex space-x-3">
              {!cameraError && (
                <button
                  onClick={capturePhoto}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 text-white py-3 rounded-lg font-semibold hover:from-amber-600 hover:to-orange-700 transition shadow-lg"
                >
                  Capturar Foto
                </button>
              )}
              <button
                onClick={() => {
                  setShowCamera(false);
                  setCameraError(null);
                  if (streamRef.current) {
                    streamRef.current.getTracks().forEach((track) => track.stop());
                  }
                }}
                className="px-6 bg-gray-500 text-white py-3 rounded-lg font-semibold hover:bg-gray-600 transition"
              >
                {cameraError ? 'Voltar' : 'Cancelar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const overtimeCheck = isOvertimePeriod();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Bater Ponto</h2>
        <p className="text-gray-600">Registre sua entrada ou saída</p>
      </div>

      {!isOnline && (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-lg">
          <div className="flex items-center">
            <WifiOff className="w-5 h-5 text-yellow-600 mr-3" />
            <div>
              <p className="text-sm font-semibold text-yellow-800">Modo Offline</p>
              <p className="text-xs text-yellow-700 mt-1">
                Você está sem internet. Seu ponto será salvo e sincronizado automaticamente quando voltar online.
              </p>
              {pendingSync > 0 && (
                <p className="text-xs text-yellow-800 mt-2 font-semibold">
                  {pendingSync} {pendingSync === 1 ? 'registro pendente' : 'registros pendentes'} de sincronização
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {isOnline && pendingSync > 0 && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
          <div className="flex items-center">
            <Wifi className="w-5 h-5 text-blue-600 mr-3 animate-pulse" />
            <div>
              <p className="text-sm font-semibold text-blue-800">Sincronizando...</p>
              <p className="text-xs text-blue-700 mt-1">
                {pendingSync} {pendingSync === 1 ? 'registro está' : 'registros estão'} sendo sincronizado com o servidor.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full mb-4">
            <Clock className="w-12 h-12 text-white" />
          </div>
          <h3 className="text-2xl font-bold text-gray-800">
            {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </h3>
          <p className="text-gray-600 mt-1">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        {overtimeCheck.isOvertime && !activeSession && (
          <div className="mb-6 bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-orange-800 mb-1">
              Período de Hora Extra
            </p>
            <p className="text-xs text-orange-600">
              {overtimeCheck.type === 'lunch'
                ? 'Você está no horário de almoço. Bater ponto agora será registrado como hora extra.'
                : 'Você está após o horário de expediente. Bater ponto agora será registrado como hora extra.'}
            </p>
          </div>
        )}

        {capturedImage && (
          <div className="mb-6">
            <p className="text-sm font-medium text-gray-700 mb-2">Selfie capturada:</p>
            <img src={capturedImage} alt="Selfie" className="w-full max-w-sm mx-auto rounded-lg" />
          </div>
        )}

        {!activeSession ? (
          <div className="space-y-4">
            {!capturedImage ? (
              <button
                onClick={startCamera}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-4 rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-lg flex items-center justify-center space-x-2"
              >
                <Camera className="w-5 h-5" />
                <span>Tirar Selfie com EPI</span>
              </button>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={handleClockIn}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-4 rounded-lg font-semibold hover:from-green-600 hover:to-green-700 transition shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>{loading ? 'Registrando...' : 'Registrar Entrada'}</span>
                </button>
                <button
                  onClick={() => setCapturedImage(null)}
                  className="w-full bg-gray-500 text-white py-3 rounded-lg font-semibold hover:bg-gray-600 transition"
                >
                  Tirar Outra Foto
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className={`border rounded-lg p-4 flex items-center space-x-3 ${
              isOvertimeSession
                ? 'bg-orange-50 border-orange-200'
                : 'bg-green-50 border-green-200'
            }`}>
              <div className={`w-3 h-3 rounded-full animate-pulse ${
                isOvertimeSession ? 'bg-orange-500' : 'bg-green-500'
              }`}></div>
              <div>
                <p className={`text-sm font-medium ${
                  isOvertimeSession ? 'text-orange-800' : 'text-green-800'
                }`}>
                  {isOvertimeSession ? 'Trabalhando (Hora Extra)' : 'Você está trabalhando'}
                </p>
                <p className={`text-xs ${
                  isOvertimeSession ? 'text-orange-600' : 'text-green-600'
                }`}>
                  Entrada: {new Date(activeSession.clock_in_time).toLocaleTimeString('pt-BR')}
                </p>
              </div>
            </div>
            <button
              onClick={handleClockOut}
              disabled={loading}
              className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white py-4 rounded-lg font-semibold hover:from-red-600 hover:to-red-700 transition shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              <MapPin className="w-5 h-5" />
              <span>{loading ? 'Registrando...' : 'Registrar Saída'}</span>
            </button>
          </div>
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          if (modalTitle === 'Ponto Batido' || modalTitle === 'Ponto Batido - Hora Extra') {
            setShowEpiModal(true);
          }
        }}
        title={modalTitle}
        message={modalMessage}
      />

      <Modal
        isOpen={showEpiModal}
        onClose={() => setShowEpiModal(false)}
        title="Lembrete de Segurança"
        message="Verifique seus equipamentos de EPIs para sua segurança e a de seus colegas"
      />
    </div>
  );
}
