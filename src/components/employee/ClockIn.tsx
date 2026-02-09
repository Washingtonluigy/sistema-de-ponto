import { useState, useRef, useEffect, useCallback } from 'react';
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
  const [isCheckingSession, setIsCheckingSession] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notes, setNotes] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const checkSessionTimeoutRef = useRef<number | null>(null);

  const checkPendingSync = useCallback(async () => {
    try {
      const pending = await offlineStorage.getPendingEntries();
      setPendingSync(pending.length);
    } catch (error) {
      console.error('[SYNC] Erro ao verificar pendências:', error);
    }
  }, []);

  const checkActiveSession = useCallback(async () => {
    if (!user) return;

    if (isCheckingSession) {
      console.log('[SESSION] Verificação já em andamento, ignorando...');
      return;
    }

    if (checkSessionTimeoutRef.current) {
      clearTimeout(checkSessionTimeoutRef.current);
    }

    checkSessionTimeoutRef.current = window.setTimeout(async () => {
      setIsCheckingSession(true);

      try {
        console.log('[SESSION] Verificando sessão ativa...');

        const { data, error } = await supabase
          .from('active_sessions')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('[SESSION] Erro ao buscar sessão:', error);
          setIsCheckingSession(false);
          return;
        }

        if (data) {
          console.log('[SESSION] Sessão ativa encontrada:', data.clock_in_time);

          const { data: currentEntry, error: entryError } = await supabase
            .from('time_entries')
            .select('is_overtime')
            .eq('user_id', user.id)
            .is('clock_out', null)
            .order('clock_in', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (entryError) {
            console.error('[SESSION] Erro ao buscar entrada:', entryError);
            setIsCheckingSession(false);
            return;
          }

          if (!currentEntry) {
            console.warn('[SESSION] Sessão órfã detectada - limpando...');
            await supabase.from('active_sessions').delete().eq('user_id', user.id);
            setActiveSession(null);
            setIsOvertimeSession(false);
          } else {
            setActiveSession(data);
            setIsOvertimeSession(currentEntry.is_overtime || false);
          }
        } else {
          console.log('[SESSION] Nenhuma sessão ativa');
          setActiveSession(null);
          setIsOvertimeSession(false);
        }
      } catch (error) {
        console.error('[SESSION] Erro inesperado:', error);
      } finally {
        setIsCheckingSession(false);
      }
    }, 300);
  }, [user, isCheckingSession]);

  useEffect(() => {
    if (!user) return;

    console.log('[MOUNT] Componente montado, iniciando verificações...');
    checkActiveSession();
    checkPendingSync();
    syncService.startAutoSync();

    return () => {
      console.log('[UNMOUNT] Limpando recursos...');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (checkSessionTimeoutRef.current) {
        clearTimeout(checkSessionTimeoutRef.current);
      }
    };
  }, [user]);

  useEffect(() => {
    if (isOnline) {
      console.log('[ONLINE] Voltou online, sincronizando...');
      syncService.syncPendingEntries().then(() => {
        checkPendingSync();
        checkActiveSession();
      });
    }
  }, [isOnline, checkPendingSync, checkActiveSession]);

  useEffect(() => {
    if (!activeSession || !profile) return;

    console.log('[AUTO-CLOCKOUT] Iniciando monitoramento...');
    const interval = setInterval(() => {
      checkAutoClockOut();
    }, 30000);

    return () => {
      console.log('[AUTO-CLOCKOUT] Parando monitoramento...');
      clearInterval(interval);
    };
  }, [activeSession, profile]);

  const handleResetSession = useCallback(async () => {
    if (!user || loading) return;

    try {
      console.log('[RESET] Resetando sessão...');
      setLoading(true);
      await supabase.from('active_sessions').delete().eq('user_id', user.id);
      await offlineStorage.clearAll();
      setActiveSession(null);
      setCapturedImage(null);
      closeCamera();
      setModalTitle('Sessão Resetada');
      setModalMessage('Sua sessão foi resetada com sucesso. Agora você pode bater ponto normalmente.');
      setModalOpen(true);
      console.log('[RESET] Sessão resetada com sucesso');
    } catch (error: any) {
      console.error('[RESET] Erro ao resetar:', error);
      setModalTitle('Erro');
      setModalMessage('Erro ao resetar sessão: ' + error.message);
      setModalOpen(true);
    } finally {
      setLoading(false);
    }
  }, [user, loading, closeCamera]);

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
        const totalHours = Math.max(0, (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60));

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

    const now = new Date();
    const isSunday = now.getDay() === 0;
    if (isSunday) {
      return { isOvertime: true, type: 'weekend' };
    }

    const currentMinutes = getCurrentTimeInMinutes();
    const lunchStart = profile.horario_saida_almoco ? timeStringToMinutes(profile.horario_saida_almoco) : null;
    const lunchEnd = profile.horario_volta_almoco ? timeStringToMinutes(profile.horario_volta_almoco) : null;
    const endTime = profile.horario_saida ? timeStringToMinutes(profile.horario_saida) : null;

    const isLunchPeriod = lunchStart && lunchEnd && currentMinutes >= lunchStart && currentMinutes < lunchEnd;
    const isAfterHours = endTime && currentMinutes >= endTime;

    return { isOvertime: isLunchPeriod || isAfterHours, type: isLunchPeriod ? 'lunch' : 'after_hours' };
  };

  const startCamera = useCallback(async () => {
    if (showCamera || streamRef.current) {
      console.log('[CAMERA] Câmera já está aberta ou em uso, ignorando...');
      return;
    }

    if (loading) {
      console.log('[CAMERA] Operação em andamento, aguarde...');
      return;
    }

    setCameraError(null);
    setShowCamera(true);

    console.log('[CAMERA] Iniciando acesso à câmera...');
    console.log('[CAMERA] Online:', isOnline);
    console.log('[CAMERA] Contexto seguro (HTTPS):', window.isSecureContext);
    console.log('[CAMERA] Navigator.mediaDevices disponível:', !!navigator.mediaDevices);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const errorMsg = 'Câmera não disponível. Certifique-se de que o app está instalado e você está usando HTTPS.';
      console.error('[CAMERA]', errorMsg);
      setCameraError(errorMsg);
      closeCamera();
      return;
    }

    if (!window.isSecureContext) {
      const errorMsg = 'Câmera requer contexto seguro (HTTPS). Acesse o app via HTTPS ou instale como PWA.';
      console.error('[CAMERA]', errorMsg);
      setCameraError(errorMsg);
      closeCamera();
      return;
    }

    try {
      console.log('[CAMERA] Solicitando permissão...');

      const constraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      console.log('[CAMERA] Permissão concedida, stream obtido:', stream.id);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        console.log('[CAMERA] Stream conectado ao elemento de vídeo');
      }
    } catch (error: any) {
      console.error('[CAMERA] Erro ao acessar câmera:', error.name, error.message);

      let errorMsg = 'Erro ao acessar câmera. ';

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMsg += 'Permissão negada. ';
        if (/android/i.test(navigator.userAgent)) {
          errorMsg += 'No Android: vá em Configurações > Apps > ' + (document.title || 'Este App') + ' > Permissões e ative a Câmera.';
        } else {
          errorMsg += 'Clique no ícone de cadeado na barra de endereço e permita o acesso à câmera.';
        }
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMsg += 'Nenhuma câmera foi encontrada no dispositivo.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMsg += 'A câmera está sendo usada por outro app. Feche outros apps que possam estar usando a câmera e tente novamente.';
      } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
        errorMsg += 'A câmera do seu dispositivo não suporta as configurações solicitadas. Tentando com configurações mais simples...';

        try {
          console.log('[CAMERA] Tentando com configurações simplificadas...');
          const simpleStream = await navigator.mediaDevices.getUserMedia({ video: true });
          streamRef.current = simpleStream;
          if (videoRef.current) {
            videoRef.current.srcObject = simpleStream;
            console.log('[CAMERA] Sucesso com configurações simplificadas');
          }
          return;
        } catch (retryError: any) {
          console.error('[CAMERA] Falha na segunda tentativa:', retryError);
          errorMsg = 'Não foi possível acessar a câmera mesmo com configurações simplificadas.';
        }
      } else if (error.name === 'SecurityError') {
        errorMsg += 'Erro de segurança. Certifique-se de estar acessando via HTTPS ou usando o app instalado.';
      } else {
        errorMsg += error.message || 'Verifique as permissões e tente novamente.';
      }

      setCameraError(errorMsg);
      closeCamera();
    }
  }, [showCamera, loading, isOnline, closeCamera]);

  const closeCamera = useCallback(() => {
    console.log('[CAMERA] Fechando câmera...');
    setShowCamera(false);
    setCameraError(null);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log('[CAMERA] Track parado:', track.kind);
      });
      streamRef.current = null;
    }
  }, []);

  const retakePhoto = useCallback(() => {
    console.log('[CAMERA] Tirando nova foto...');
    setCapturedImage(null);
    closeCamera();
  }, [closeCamera]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) {
      console.log('[CAMERA] Elemento de vídeo não disponível');
      return;
    }

    if (capturedImage) {
      console.log('[CAMERA] Foto já capturada, ignorando...');
      return;
    }

    console.log('[CAMERA] Capturando foto...');
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedImage(imageData);
      closeCamera();
      console.log('[CAMERA] Foto capturada com sucesso');
    }
  }, [capturedImage, closeCamera]);

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

  const handleClockIn = async (observation?: string) => {
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
      const notesText = observation?.trim() || null;

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
          notes: notesText,
          type: 'clock_in' as const,
          timestamp: Date.now(),
        };

        await offlineStorage.addPendingEntry(pendingEntry);
        await checkPendingSync();
        setCapturedImage(null);
        setNotes('');

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
          notes: notesText,
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
      setNotes('');

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

  const handleClockOut = async (observation?: string) => {
    console.log('[CLOCK OUT] Iniciando registro de saída...');
    setLoading(true);

    try {
      console.log('[CLOCK OUT] User ID:', user?.id);
      console.log('[CLOCK OUT] Online status:', isOnline);

      const clockOutTime = new Date().toISOString();
      const notesText = observation?.trim() || null;

      if (!isOnline) {
        console.log('[CLOCK OUT] Modo offline detectado');
        const pendingEntry = {
          id: `pending-out-${Date.now()}`,
          user_id: user!.id,
          clock_out: clockOutTime,
          location_lat: 0,
          location_lng: 0,
          selfie_url: '',
          is_overtime: false,
          overtime_type: null,
          notes: notesText,
          type: 'clock_out' as const,
          timestamp: Date.now(),
          total_hours: 0,
        };

        await offlineStorage.addPendingEntry(pendingEntry);
        await checkPendingSync();

        setActiveSession(null);
        setNotes('');

        setModalTitle('Saída Salva Offline');
        setModalMessage('Sua saída foi salva localmente e será enviada quando houver internet.');
        setModalOpen(true);
        setLoading(false);
        return;
      }

      console.log('[CLOCK OUT] Buscando última entrada em aberto...');
      const { data: lastEntry, error: fetchError } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', user?.id)
        .is('clock_out', null)
        .order('clock_in', { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log('[CLOCK OUT] Resultado da busca:', { lastEntry, fetchError });

      if (fetchError) {
        console.error('[CLOCK OUT] Erro ao buscar última entrada:', fetchError);
        throw new Error('Erro ao buscar registro de entrada: ' + fetchError.message);
      }

      if (!lastEntry) {
        console.error('[CLOCK OUT] Nenhuma entrada em aberto encontrada');
        throw new Error('Nenhuma entrada em aberto encontrada. Por favor, registre uma entrada primeiro.');
      }

      console.log('[CLOCK OUT] Calculando horas trabalhadas...');
      const clockIn = new Date(lastEntry.clock_in);
      const clockOut = new Date();
      const totalHours = Math.max(0, (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60));

      console.log('[CLOCK OUT] Horas trabalhadas:', totalHours);
      console.log('[CLOCK OUT] Atualizando registro no banco...');

      const updateData: any = {
        clock_out: clockOut.toISOString(),
        total_hours: totalHours,
      };

      if (notesText) {
        updateData.notes = lastEntry.notes ? `${lastEntry.notes}\n[SAÍDA] ${notesText}` : `[SAÍDA] ${notesText}`;
      }

      const { error: updateError } = await supabase
        .from('time_entries')
        .update(updateData)
        .eq('id', lastEntry.id);

      if (updateError) {
        console.error('[CLOCK OUT] Erro ao atualizar registro de saída:', updateError);
        throw new Error('Erro ao registrar saída: ' + updateError.message);
      }

      setNotes('');

      console.log('[CLOCK OUT] Registro atualizado com sucesso!');

      console.log('[CLOCK OUT] Recalculando horas extras do mês...');
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const workHours = profile?.work_hours || 8;
      const overtimeLimit = profile?.overtime_limit || 30;

      const { recalculateMonthlyOvertime } = await import('../../lib/overtimeCalculator');
      await recalculateMonthlyOvertime(user!.id, month, year, workHours, overtimeLimit);

      console.log('[CLOCK OUT] Removendo sessão ativa...');
      const { error: deleteError } = await supabase.from('active_sessions').delete().eq('user_id', user?.id);

      if (deleteError) {
        console.error('[CLOCK OUT] Erro ao deletar sessão ativa:', deleteError);
      } else {
        console.log('[CLOCK OUT] Sessão ativa removida com sucesso!');
      }

      console.log('[CLOCK OUT] Atualizando estado local...');
      await checkActiveSession();

      console.log('[CLOCK OUT] Processo finalizado com sucesso!');
      setModalTitle('Saída Registrada');
      setModalMessage('Sua saída foi registrada com sucesso!');
      setModalOpen(true);
    } catch (error: any) {
      console.error('[CLOCK OUT] ERRO COMPLETO:', error);
      console.error('[CLOCK OUT] Stack trace:', error.stack);
      setModalTitle('Erro ao Registrar Saída');
      setModalMessage(error.message || 'Ocorreu um erro desconhecido. Por favor, tente novamente.');
      setModalOpen(true);
    } finally {
      console.log('[CLOCK OUT] Resetando estado de loading...');
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
                onClick={closeCamera}
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
                  onClick={() => setShowNotesModal(true)}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-4 rounded-lg font-semibold hover:from-green-600 hover:to-green-700 transition shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>{loading ? 'Registrando...' : 'Registrar Entrada'}</span>
                </button>
                <button
                  onClick={retakePhoto}
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
              onClick={() => setShowNotesModal(true)}
              disabled={loading}
              className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white py-4 rounded-lg font-semibold hover:from-red-600 hover:to-red-700 transition shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              <MapPin className="w-5 h-5" />
              <span>{loading ? 'Registrando...' : 'Registrar Saída'}</span>
            </button>
            <button
              onClick={() => {
                if (confirm('Tem certeza? Isso irá resetar sua sessão atual. Use apenas se estiver com problemas para bater ponto.')) {
                  handleResetSession();
                }
              }}
              className="w-full bg-gray-400 text-white py-2 rounded-lg text-sm hover:bg-gray-500 transition"
            >
              Resetar Sessão (usar apenas se travado)
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

      {showNotesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-fadeIn">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 mb-4">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Alguma observação sobre o horário do ponto?
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Campo opcional. Use para justificar atrasos ou esquecimentos.
              </p>
            </div>

            <div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Esqueci de bater o ponto na hora certa, reunião inesperada, etc..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition resize-none"
                rows={4}
                maxLength={500}
              />
              <div className="text-right text-xs text-gray-400 mt-1">
                {notes.length}/500 caracteres
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setShowNotesModal(false);
                  setNotes('');
                }}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setShowNotesModal(false);
                  if (activeSession) {
                    handleClockOut(notes);
                  } else {
                    handleClockIn(notes);
                  }
                }}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-lg disabled:opacity-50"
              >
                {loading ? 'Registrando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
