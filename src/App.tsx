import React, { useEffect, useMemo, useState } from 'react';
import {
  Bike,
  CheckCircle2,
  Clock,
  RotateCcw,
  AlertCircle,
  Timer,
} from 'lucide-react';
import type { DuofietsStatus } from './types';
import {
  subscribeToDuofietsStatus,
  saveDuofietsStatusToFirebase,
} from './firebase';

// Relatieve paden voor afbeeldingen zodat het direct werkt op GitHub Pages en lokaal
const LOGO_IMAGE_PATH = './assets/logo.jpg';
const LOGO_FALLBACK_PATH = './assets/aistudio/Lichtenbeek_logo_100__badf7cc8.jpg';
const HERO_IMAGE_PATH = './assets/images/elektrische_duofiets_hero.jpg';

const LOCAL_STORAGE_KEY = 'lichtenbeek_duofiets_status';

function getCurrentTimeHHMM(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function addMinutesToTime(currentTimeStr: string, minutesToAdd: number): string {
  const [hStr, mStr] = currentTimeStr.split(':');
  const h = Number(hStr) || 0;
  const m = Number(mStr) || 0;
  const totalMinutes = Math.min(23 * 60 + 55, Math.max(0, h * 60 + m + minutesToAdd));
  const newH = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const newM = String(Math.floor((totalMinutes % 60) / 5) * 5).padStart(2, '0');
  return `${newH}:${newM}`;
}

function timeToMinutes(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(':');
  return (Number(hStr) || 0) * 60 + (Number(mStr) || 0);
}

function getRemainingTimeText(expectedReturnTime: string, currentHHMM: string): {
  label: string;
  isOverdue: boolean;
} {
  const expMins = timeToMinutes(expectedReturnTime);
  const nowMins = timeToMinutes(currentHHMM);
  const diff = expMins - nowMins;

  if (diff < 0) {
    const overdueMins = Math.abs(diff);
    const hrs = Math.floor(overdueMins / 60);
    const mins = overdueMins % 60;
    const text =
      hrs > 0 ? `${hrs} uur en ${mins} min later dan gepland` : `${mins} min later dan gepland`;
    return { label: text, isOverdue: true };
  }

  if (diff === 0) {
    return { label: 'Wordt nu elk moment terugverwacht', isOverdue: false };
  }

  const hrs = Math.floor(diff / 60);
  const mins = diff % 60;
  if (hrs > 0) {
    return {
      label: `Nog circa ${hrs} uur en ${mins} min`,
      isOverdue: false,
    };
  }
  return {
    label: `Nog circa ${mins} minuten`,
    isOverdue: false,
  };
}

function getLocalStoredStatus(): DuofietsStatus {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Negeer fouten bij openen van localStorage
  }
  return {
    isAvailable: true,
    updatedAt: new Date().toISOString(),
  };
}

function setLocalStoredStatus(status: DuofietsStatus): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(status));
  } catch {
    // Negeer
  }
}

export default function App() {
  const [status, setStatus] = useState<DuofietsStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<string>(getCurrentTimeHHMM());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [heroImageFailed, setHeroImageFailed] = useState<boolean>(false);
  const [logoFailed, setLogoFailed] = useState<boolean>(false);

  // Formulier statussen
  const [selectedReturnTime, setSelectedReturnTime] = useState<string>(() =>
    addMinutesToTime(getCurrentTimeHHMM(), 90)
  );
  const [showAdjustTime, setShowAdjustTime] = useState<boolean>(false);
  const [adjustedTime, setAdjustedTime] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Houd de lokale tijd actueel
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(getCurrentTimeHHMM());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Luister realtime naar de centrale Firebase database (werkt wereldwijd op alle apparaten & GitHub Pages)
  useEffect(() => {
    let isMounted = true;

    // Start direct met eventuele gecachte lokale status voor snelle weergave
    const cached = getLocalStoredStatus();
    setStatus(cached);
    if (cached.expectedReturnTime) {
      setAdjustedTime(addMinutesToTime(cached.expectedReturnTime, 30));
    }

    const unsubscribe = subscribeToDuofietsStatus(
      (cloudStatus) => {
        if (!isMounted) return;
        setStatus(cloudStatus);
        setLocalStoredStatus(cloudStatus);
        setLoading(false);
        if (cloudStatus.expectedReturnTime) {
          setAdjustedTime(addMinutesToTime(cloudStatus.expectedReturnTime, 30));
        }
      },
      (err) => {
        console.warn('Realtime database verbinding fout:', err);
        if (isMounted) {
          setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  function notify(msg: string) {
    setFeedbackMsg(msg);
    setTimeout(() => {
      setFeedbackMsg((prev) => (prev === msg ? null : prev));
    }, 4000);
  }

  // Fiets meenemen / geleend melden
  async function handleBorrow(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!selectedReturnTime) {
      setErrorMsg('Kies tot hoe laat de fiets weg is.');
      return;
    }
    setErrorMsg(null);
    setIsSubmitting(true);

    const newStatus: DuofietsStatus = {
      isAvailable: false,
      expectedReturnTime: selectedReturnTime,
      borrowedAt: getCurrentTimeHHMM(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveDuofietsStatusToFirebase(newStatus);
      setStatus(newStatus);
      setLocalStoredStatus(newStatus);
      notify(`Geleend gemeld tot ${selectedReturnTime} uur.`);
    } catch (err) {
      console.error(err);
      setErrorMsg('Kon de status niet synchroniseren. Controleer de internetverbinding.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Fiets terugbrengen
  async function handleReturn() {
    setErrorMsg(null);
    setIsSubmitting(true);

    const newStatus: DuofietsStatus = {
      isAvailable: true,
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveDuofietsStatusToFirebase(newStatus);
      setStatus(newStatus);
      setLocalStoredStatus(newStatus);
      setShowAdjustTime(false);
      setSelectedReturnTime(addMinutesToTime(getCurrentTimeHHMM(), 90));
      notify('De duofiets is weer teruggemeld en direct beschikbaar voor iedereen.');
    } catch (err) {
      console.error(err);
      setErrorMsg('Kon de status niet synchroniseren. Probeer het opnieuw.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Terugkomsttijd aanpassen
  async function handleAdjustTime(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustedTime) {
      setErrorMsg('Kies een nieuwe tijd.');
      return;
    }
    setErrorMsg(null);
    setIsSubmitting(true);

    const newStatus: DuofietsStatus = {
      ...(status || { isAvailable: false }),
      isAvailable: false,
      expectedReturnTime: adjustedTime,
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveDuofietsStatusToFirebase(newStatus);
      setStatus(newStatus);
      setLocalStoredStatus(newStatus);
      setShowAdjustTime(false);
      notify(`Verwachte terugkomsttijd is aangepast naar ${adjustedTime} uur.`);
    } catch (err) {
      console.error(err);
      setErrorMsg('Kon de tijd niet aanpassen.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const isAvailable = status?.isAvailable ?? true;
  const expectedReturnTime = status?.expectedReturnTime;
  const remainingInfo = useMemo(() => {
    if (!expectedReturnTime) return null;
    return getRemainingTimeText(expectedReturnTime, currentTime);
  }, [expectedReturnTime, currentTime]);

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#1E282A] flex flex-col selection:bg-[#009BB0] selection:text-white">
      {/* Top Bar met De Lichtenbeek Logo & Live Klok */}
      <header className="bg-white border-b border-[#E8E4DA] px-4 sm:px-8 py-3.5 shadow-xs">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {!logoFailed ? (
              <img
                src={LOGO_IMAGE_PATH}
                alt="De Lichtenbeek - De Onderwijsspecialisten"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (target.src.indexOf('logo.jpg') !== -1) {
                    target.src = LOGO_FALLBACK_PATH;
                  } else {
                    setLogoFailed(true);
                  }
                }}
                className="h-9 sm:h-11 w-auto object-contain"
              />
            ) : (
              <div className="flex items-center gap-2">
                <Bike className="w-6 h-6 text-[#009BB0]" />
                <span className="font-display font-bold text-lg text-[#009BB0] tracking-tight">
                  De Lichtenbeek
                </span>
              </div>
            )}
            <div className="hidden sm:block border-l border-[#E2DDCF] pl-3 text-xs text-[#8C7C52] font-medium leading-tight">
              <div>Elektrische Duofiets</div>
              <div className="text-[11px] text-stone-400">Live Beschikbaarheid</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[#8C7C52] font-mono tabular-nums bg-[#F7F5ED] border border-[#E8E2D2] px-3 py-1.5 rounded-full">
            <Clock className="w-3.5 h-3.5 text-[#009BB0]" />
            <span>{currentTime} uur</span>
          </div>
        </div>
      </header>

      {/* Hoofdsectie */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 flex flex-col justify-center">
        {/* Bevestigingsbericht */}
        {feedbackMsg && (
          <div
            role="status"
            className="mb-5 bg-[#007E8F] text-white px-5 py-3.5 rounded-xl text-sm font-medium flex items-center justify-between shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#B3E7EE] shrink-0" />
              <span>{feedbackMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackMsg(null)}
              className="text-xs text-[#B3E7EE] hover:text-white underline ml-4 cursor-pointer"
            >
              Sluiten
            </button>
          </div>
        )}

        {/* Foutmelding */}
        {errorMsg && (
          <div
            role="alert"
            className="mb-5 bg-red-50 border border-red-200 text-red-900 px-5 py-3.5 rounded-xl text-sm flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-xs text-red-700 hover:underline ml-4 cursor-pointer"
            >
              Sluiten
            </button>
          </div>
        )}

        {/* Laadstatus */}
        {loading ? (
          <div className="bg-white border border-[#E8E4DA] rounded-2xl p-8 sm:p-12 shadow-xs space-y-6 animate-pulse">
            <div className="h-8 bg-[#F5F2EA] rounded-lg w-2/3" />
            <div className="h-16 bg-[#F5F2EA] rounded-xl" />
            <div className="h-12 bg-[#F5F2EA] rounded-xl w-1/2" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* HOOFD STATUSKAART */}
            <div
              className={`bg-white border rounded-2xl overflow-hidden shadow-sm transition-colors duration-200 ${
                isAvailable
                  ? 'border-[#009BB0]/30 shadow-[#009BB0]/5'
                  : 'border-[#B6A476]/40 shadow-[#B6A476]/5'
              }`}
            >
              {/* Foto Banner met duofiets */}
              <div className="relative h-44 sm:h-52 w-full bg-stone-100 overflow-hidden">
                {!heroImageFailed ? (
                  <img
                    src={HERO_IMAGE_PATH}
                    alt="Elektrische duofiets De Lichtenbeek"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImageFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#F7F5ED] text-[#8C7C52]">
                    <Bike className="w-12 h-12" />
                  </div>
                )}

                {/* Status Badge in Lichtenbeek Kleuren */}
                <div className="absolute top-4 right-4">
                  <div
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-md flex items-center gap-2 backdrop-blur-md ${
                      isAvailable
                        ? 'bg-[#009BB0] text-white'
                        : 'bg-[#B6A476] text-white'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <span>{isAvailable ? 'Nu aanwezig' : 'Uitgeleend'}</span>
                  </div>
                </div>

                {/* Subtiele tag */}
                <div className="absolute bottom-3 left-4 bg-black/60 backdrop-blur-xs text-white text-[11px] px-2.5 py-1 rounded-md font-medium">
                  De Lichtenbeek · Elektrische Duofiets
                </div>
              </div>

              {/* KAART INHOUD */}
              <div className="p-6 sm:p-8 space-y-6">
                {/* SITUATIE 1: DE FIETS IS AANWEZIG */}
                {isAvailable ? (
                  <div className="space-y-6">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-[#009BB0] text-sm font-semibold">
                        <CheckCircle2 className="w-5 h-5 text-[#009BB0]" />
                        <span>De duofiets staat in de stalling</span>
                      </div>
                      <h1 className="text-2xl sm:text-3xl font-bold font-display text-[#1E282A] tracking-tight">
                        De duofiets is aanwezig
                      </h1>
                      <p className="text-sm text-stone-600">
                        De duofiets is momenteel niet uitgeleend en kan direct worden gebruikt.
                      </p>
                    </div>

                    {/* Leen actie formulier */}
                    <div className="pt-6 border-t border-[#EFECE3] space-y-4">
                      <div className="space-y-2.5">
                        <label className="block text-xs font-semibold text-[#8C7C52] uppercase tracking-wider">
                          Tot hoe laat leen je de duofiets?
                        </label>

                        {/* Snelle Tijdkeuzeknoppen */}
                        <div className="flex flex-wrap items-center gap-2">
                          {[
                            { label: '1 uur', mins: 60 },
                            { label: '1,5 uur', mins: 90 },
                            { label: '2 uur', mins: 120 },
                            { label: '3 uur', mins: 180 },
                            { label: 'Middag (+4u)', mins: 240 },
                          ].map((preset) => {
                            const calculated = addMinutesToTime(currentTime, preset.mins);
                            const isSelected = selectedReturnTime === calculated;
                            return (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => setSelectedReturnTime(calculated)}
                                className={`px-3 py-2 text-xs rounded-lg transition-colors font-mono tabular-nums cursor-pointer ${
                                  isSelected
                                    ? 'bg-[#009BB0] text-white font-semibold shadow-xs'
                                    : 'bg-[#F7F5ED] text-[#6E603E] hover:bg-[#EFEAD9] border border-[#E5DECD]'
                                }`}
                              >
                                {preset.label} ({calculated})
                              </button>
                            );
                          })}
                        </div>

                        {/* Directe tijdinvoer */}
                        <div className="pt-2 flex items-center gap-3">
                          <span className="text-xs text-stone-500">Of kies zelf een tijd:</span>
                          <input
                            type="time"
                            value={selectedReturnTime}
                            onChange={(e) => setSelectedReturnTime(e.target.value)}
                            aria-label="Verwachte terugkomsttijd"
                            className="px-3 py-2 text-sm font-mono tabular-nums font-semibold bg-[#FAF9F6] border border-[#D8D2C2] rounded-lg text-[#1E282A] focus:outline-none focus:ring-2 focus:ring-[#009BB0] w-32"
                          />
                          <span className="text-xs text-stone-500 font-mono tabular-nums">uur</span>
                        </div>
                      </div>

                      {/* Grote Leenknop */}
                      <button
                        type="button"
                        onClick={() => handleBorrow()}
                        disabled={isSubmitting || !selectedReturnTime}
                        className="w-full mt-2 py-3.5 px-6 text-base font-semibold text-white bg-[#009BB0] hover:bg-[#008699] active:bg-[#007484] disabled:opacity-50 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Bike className="w-5 h-5" />
                        <span>
                          {isSubmitting
                            ? 'Bezig met opslaan...'
                            : `Ik leen de duofiets (terug om ${selectedReturnTime} uur)`}
                        </span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* SITUATIE 2: DE FIETS IS WEG (GELEEND) */
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[#8C7C52] text-sm font-semibold">
                        <Clock className="w-5 h-5 text-[#8C7C52]" />
                        <span>Duofiets is momenteel onderweg</span>
                      </div>

                      <h1 className="text-2xl sm:text-3xl font-bold font-display text-[#1E282A] tracking-tight">
                        De duofiets is geleend
                      </h1>

                      {/* Grote Tijdsaanduiding */}
                      <div className="bg-[#FAF7F0] border border-[#E5DECD] rounded-xl p-5 my-4 space-y-1">
                        <div className="text-xs text-[#8C7C52] font-semibold uppercase tracking-wider">
                          Verwachte terugkomsttijd:
                        </div>
                        <div className="text-3xl sm:text-4xl font-extrabold text-[#06535F] font-mono tabular-nums tracking-tight">
                          {expectedReturnTime} <span className="text-lg font-normal text-stone-600">uur</span>
                        </div>
                        <div
                          className={`text-xs font-semibold mt-1 ${
                            remainingInfo?.isOverdue ? 'text-red-700' : 'text-[#8C7C52]'
                          }`}
                        >
                          {remainingInfo?.label}
                          {status?.borrowedAt && (
                            <span className="font-normal text-stone-500 font-mono tabular-nums ml-2">
                              · Vertrokken om {status.borrowedAt} uur
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Grote Terugbrengknop */}
                    <button
                      type="button"
                      onClick={handleReturn}
                      disabled={isSubmitting}
                      className="w-full py-4 px-6 text-base font-bold text-white bg-[#009BB0] hover:bg-[#008699] active:bg-[#007484] disabled:opacity-50 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2.5 cursor-pointer"
                    >
                      <RotateCcw className="w-5 h-5" />
                      <span>
                        {isSubmitting
                          ? 'Bezig met afmelden...'
                          : 'Ik heb de duofiets teruggebracht'}
                      </span>
                    </button>

                    {/* Tijd verlengen als de rit uitloopt */}
                    <div className="pt-2 text-center">
                      {!showAdjustTime ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (expectedReturnTime) {
                              setAdjustedTime(addMinutesToTime(expectedReturnTime, 30));
                            }
                            setShowAdjustTime(true);
                          }}
                          className="inline-flex items-center gap-1.5 text-xs text-[#8C7C52] hover:text-[#009BB0] font-medium underline underline-offset-4 py-1 cursor-pointer"
                        >
                          <Timer className="w-3.5 h-3.5 text-[#009BB0]" />
                          <span>Duurt de rit langer? Pas de terugkomsttijd aan</span>
                        </button>
                      ) : (
                        <form
                          onSubmit={handleAdjustTime}
                          className="bg-[#FAF7F0] border border-[#E5DECD] rounded-xl p-4 text-left space-y-3"
                        >
                          <div className="text-xs font-semibold text-[#8C7C52]">
                            Nieuwe verwachte terugkomsttijd:
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {[15, 30, 45, 60].map((mins) => {
                              const calculated = addMinutesToTime(
                                expectedReturnTime || currentTime,
                                mins
                              );
                              return (
                                <button
                                  key={mins}
                                  type="button"
                                  onClick={() => setAdjustedTime(calculated)}
                                  className="px-2.5 py-1.5 text-xs font-medium text-[#6E603E] bg-white border border-[#E0D9C8] hover:bg-[#F3EFE4] rounded font-mono tabular-nums cursor-pointer"
                                >
                                  +{mins} min ({calculated})
                                </button>
                              );
                            })}
                          </div>

                          <div className="flex items-center gap-3 pt-1">
                            <input
                              type="time"
                              required
                              value={adjustedTime}
                              onChange={(e) => setAdjustedTime(e.target.value)}
                              className="px-3 py-1.5 text-xs font-mono tabular-nums font-semibold bg-white border border-[#D8D2C2] rounded-md text-[#1E282A]"
                            />
                            <button
                              type="submit"
                              disabled={isSubmitting}
                              className="px-4 py-1.5 text-xs font-semibold text-white bg-[#009BB0] hover:bg-[#008699] rounded-md cursor-pointer"
                            >
                              Opslaan
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowAdjustTime(false)}
                              className="text-xs text-stone-500 hover:text-stone-800 cursor-pointer"
                            >
                              Annuleren
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Subtiele footer met motto van De Lichtenbeek */}
            <div className="text-center space-y-1 pt-2">
              <p className="text-xs text-[#009BB0] italic font-medium">
                "Samen laten we elk kind groeien"
              </p>
              <p className="text-[11px] text-[#8C7C52]">
                Sleutel hangt in het kluisje · Na de rit graag weer aan de acculader koppelen
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
