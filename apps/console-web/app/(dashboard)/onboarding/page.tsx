'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { useWorkspace } from '@/hooks/use-workspace';
import { Loader2, User, School, PenTool, CheckCircle2, ChevronRight, ChevronLeft, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { JENJANG_OPTIONS, Jenjang, KELAS_OPTIONS, MAPEL_OPTIONS } from '@/lib/constants';
import { TeacherProfile, SchoolIdentity } from 'shared-types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

function toTitleCase(str: string) {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

type Region = { id: string; name: string };
type Step = 'PROFILE' | 'SCHOOL' | 'SIGNATURE';

export default function OnboardingPage() {
    const router = useRouter();
    const { getToken, isLoaded: isAuthLoaded } = useAuth();
    const { user } = useUser();
    const { workspace, isLoading: isLoadingWorkspace } = useWorkspace();

    const [currentStep, setCurrentStep] = useState<Step>('PROFILE');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [provinces, setProvinces] = useState<Region[]>([]);
    const [regencies, setRegencies] = useState<Region[]>([]);
    const [isLoadingRegions, setIsLoadingRegions] = useState(false);
    const [selectedProvinceId, setSelectedProvinceId] = useState<string>('');

    // School Search State
    const [schoolSearchQuery, setSchoolSearchQuery] = useState('');
    const [schoolSuggestions, setSchoolSuggestions] = useState<any[]>([]);
    const [isSearchingSchools, setIsSearchingSchools] = useState(false);
    const [showSchoolSuggestions, setShowSchoolSuggestions] = useState(false);

    const [data, setData] = useState({
        // Profile
        full_name: user?.fullName || '',
        nip: '',
        primary_jenjang: 'SD' as Jenjang,
        primary_subject: '',
        primary_grade: 4,
        // School
        school_display_name: '',
        school_npsn: '',
        alamat: '',
        kab_kota: '',
        provinsi: '',
        // Signature
        principal_name: '',
        principal_nip: '',
        signature_location: ''
    });

    useEffect(() => {
        if (user?.fullName && !data.full_name) {
            setData(prev => ({ ...prev, full_name: user.fullName || '' }));
        }
    }, [user, data.full_name]);

    // Fetch Provinces
    useEffect(() => {
        async function fetchProvinces() {
            try {
                const res = await fetch('https://emsifa.github.io/api-wilayah-indonesia/api/provinces.json');
                const pData: Region[] = await res.json();
                setProvinces(pData);
            } catch (err) {
                console.error("Failed to fetch provinces", err);
            }
        }
        fetchProvinces();
    }, []);

    // Fetch Regencies when province changes
    useEffect(() => {
        if (!selectedProvinceId) {
            setRegencies([]);
            return;
        }

        async function fetchRegencies() {
            setIsLoadingRegions(true);
            try {
                const res = await fetch(`https://emsifa.github.io/api-wilayah-indonesia/api/regencies/${selectedProvinceId}.json`);
                const rData: Region[] = await res.json();
                setRegencies(rData);
            } catch (err) {
                console.error("Failed to fetch regencies", err);
            } finally {
                setIsLoadingRegions(false);
            }
        }
        fetchRegencies();
    }, [selectedProvinceId]);

    // Pre-fill logic for regions
    useEffect(() => {
        if (data.provinsi && provinces.length > 0 && !selectedProvinceId) {
            const found = provinces.find(p => p.name === data.provinsi.toUpperCase());
            if (found) setSelectedProvinceId(found.id);
        }
    }, [data.provinsi, provinces, selectedProvinceId]);

    // School Search Logic (Debounced)
    useEffect(() => {
        if (schoolSearchQuery.length < 3) {
            setSchoolSuggestions([]);
            return;
        }

        const handler = setTimeout(async () => {
            setIsSearchingSchools(true);
            try {
                const res = await fetch(`https://api-sekolah-indonesia.vercel.app/sekolah/s?sekolah=${encodeURIComponent(schoolSearchQuery)}`);
                const result = await res.json();
                if (result.status === 'success') {
                    setSchoolSuggestions(result.data || []);
                }
            } catch (err) {
                console.error("Failed to search schools", err);
            } finally {
                setIsSearchingSchools(false);
            }
        }, 500);

        return () => clearTimeout(handler);
    }, [schoolSearchQuery]);

    // Pre-fill existing data if any
    useEffect(() => {
        if (!workspace || !isAuthLoaded) return;

        async function fetchExisting() {
            try {
                const token = await getToken();
                const [pRes, sRes] = await Promise.all([
                    fetch(`${API_BASE}/w/${workspace.id}/profile`, { headers: { Authorization: `Bearer ${token}` } }),
                    fetch(`${API_BASE}/w/${workspace.id}/school`, { headers: { Authorization: `Bearer ${token}` } })
                ]);

                if (pRes.ok) {
                    const pData: TeacherProfile = await pRes.json();
                    setData(prev => ({
                        ...prev,
                        full_name: pData.full_name || prev.full_name,
                        nip: pData.nip || prev.nip,
                        primary_jenjang: (pData.primary_jenjang as Jenjang) || prev.primary_jenjang,
                        primary_subject: pData.primary_subject || prev.primary_subject,
                        primary_grade: pData.primary_grade || prev.primary_grade
                    }));
                }

                if (sRes.ok) {
                    const sData: SchoolIdentity = await sRes.json();
                    setData(prev => ({
                        ...prev,
                        school_display_name: sData.school_display_name || prev.school_display_name,
                        school_npsn: sData.school_npsn || prev.school_npsn,
                        alamat: sData.alamat || prev.alamat,
                        kab_kota: sData.kab_kota || prev.kab_kota,
                        provinsi: sData.provinsi || prev.provinsi,
                        principal_name: sData.principal_name || prev.principal_name,
                        principal_nip: sData.principal_nip || prev.principal_nip,
                        signature_location: sData.signature_location || prev.signature_location
                    }));
                }
            } catch (err) {
                console.error("Failed to pre-fill data", err);
            }
        }
        fetchExisting();
    }, [workspace, isAuthLoaded, getToken]);

    const handleNext = () => {
        if (currentStep === 'PROFILE') setCurrentStep('SCHOOL');
        else if (currentStep === 'SCHOOL') setCurrentStep('SIGNATURE');
    };

    const handleBack = () => {
        if (currentStep === 'SCHOOL') setCurrentStep('PROFILE');
        else if (currentStep === 'SIGNATURE') setCurrentStep('SCHOOL');
    };

    const handleSubmit = async () => {
        if (!workspace) return;
        setIsSubmitting(true);
        setError(null);

        try {
            const token = await getToken();

            // 1. Submit Profile
            const pRes = await fetch(`${API_BASE}/w/${workspace.id}/profile`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    full_name: data.full_name,
                    primary_jenjang: data.primary_jenjang,
                    primary_subject: data.primary_subject,
                    primary_grade: data.primary_grade,
                    nip: data.nip || null
                })
            });

            if (!pRes.ok) throw new Error("Gagal menyimpan profil guru.");

            // 2. Submit School & Principal
            const sRes = await fetch(`${API_BASE}/w/${workspace.id}/school`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    school_display_name: data.school_display_name,
                    kab_kota: data.kab_kota,
                    provinsi: data.provinsi,
                    alamat: data.alamat,
                    school_npsn: data.school_npsn || null,
                    principal_name: data.principal_name,
                    principal_nip: data.principal_nip || null,
                    signature_location: data.kab_kota // Derived from city
                })
            });

            if (!sRes.ok) throw new Error("Gagal menyimpan identitas sekolah.");

            router.push('/wizard');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoadingWorkspace || !isAuthLoaded) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
            </div>
        );
    }

    const steps = [
        { id: 'PROFILE', label: 'Identitas Guru', icon: User },
        { id: 'SCHOOL', label: 'Identitas Sekolah', icon: School },
        { id: 'SIGNATURE', label: 'Penandatangan', icon: PenTool },
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center py-16 px-6">
            <div className="max-w-2xl w-full space-y-8">
                {/* Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Siapkan Identitas Dokumen Anda</h1>
                    <p className="text-slate-500 font-medium text-lg">Lengkapi data untuk menghasilkan Modul Ajar yang siap cetak.</p>
                </div>

                {/* Steps Indicator */}
                <div className="flex items-center justify-between px-4">
                    {steps.map((s, idx) => (
                        <div key={s.id} className="flex flex-col items-center relative flex-1">
                            <div className={cn(
                                "z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                                currentStep === s.id ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-200" :
                                    steps.findIndex(x => x.id === currentStep) > idx ? "bg-emerald-100 border-emerald-200 text-emerald-600" :
                                        "bg-white border-slate-200 text-slate-400"
                            )}>
                                {steps.findIndex(x => x.id === currentStep) > idx ? <CheckCircle2 className="w-6 h-6" /> : <s.icon className="w-5 h-5" />}
                            </div>
                            <span className={cn(
                                "mt-3 text-[11px] font-bold uppercase tracking-widest transition-colors duration-300",
                                currentStep === s.id ? "text-emerald-700" : "text-slate-400"
                            )}>
                                {s.label}
                            </span>
                            {idx < steps.length - 1 && (
                                <div className={cn(
                                    "absolute top-5 left-[50%] right-[-50%] h-[2px] z-0",
                                    steps.findIndex(x => x.id === currentStep) > idx ? "bg-emerald-200" : "bg-slate-200"
                                )} />
                            )}
                        </div>
                    ))}
                </div>

                {/* Form Content */}
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50 p-10 mt-8 relative overflow-hidden">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl flex items-center text-sm border border-red-100 animate-in fade-in slide-in-from-top-2">
                            <AlertCircle className="w-5 h-5 mr-3 shrink-0" />
                            <p className="font-semibold">{error}</p>
                        </div>
                    )}

                    <AnimatePresence mode="wait">
                        {currentStep === 'PROFILE' && (
                            <motion.div
                                key="step-profile"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700 ml-1">
                                            Nama Lengkap Guru <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={data.full_name}
                                            onChange={e => setData(prev => ({ ...prev, full_name: e.target.value }))}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden transition-all font-medium text-slate-900"
                                            placeholder="Nama Lengkap & Gelar"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700 ml-1">NIP (Opsional)</label>
                                        <input
                                            type="text"
                                            value={data.nip}
                                            onChange={e => setData(prev => ({ ...prev, nip: e.target.value }))}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden transition-all font-medium text-slate-900"
                                            placeholder="Nomor Induk Pegawai"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700 ml-1">
                                            Jenjang Pendidikan <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={data.primary_jenjang}
                                            onChange={e => {
                                                const newJenjang = e.target.value as Jenjang;
                                                const defaultGrade = KELAS_OPTIONS[newJenjang][0];
                                                setData(prev => ({
                                                    ...prev,
                                                    primary_jenjang: newJenjang,
                                                    primary_grade: defaultGrade,
                                                    primary_subject: ''
                                                }));
                                            }}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden transition-all font-medium text-slate-900"
                                        >
                                            {JENJANG_OPTIONS.map(j => (
                                                <option key={j} value={j}>{j}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700 ml-1">
                                            Kelas Utama <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={data.primary_grade}
                                            onChange={e => setData(prev => ({ ...prev, primary_grade: parseInt(e.target.value) }))}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden transition-all font-medium text-slate-900"
                                        >
                                            {KELAS_OPTIONS[data.primary_jenjang].map(g => (
                                                <option key={g} value={g}>Kelas {g}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2 col-span-full">
                                        <label className="text-sm font-bold text-slate-700 ml-1">
                                            Mata Pelajaran Utama <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={data.primary_subject}
                                                onChange={e => setData(prev => ({ ...prev, primary_subject: e.target.value }))}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden transition-all font-medium text-slate-900"
                                                placeholder="Contoh: Matematika"
                                                list="subject-suggestions"
                                            />
                                            <datalist id="subject-suggestions">
                                                {MAPEL_OPTIONS[data.primary_jenjang].map(m => (
                                                    <option key={m} value={m} />
                                                ))}
                                            </datalist>
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-medium mt-1 uppercase tracking-tight">Pilih dari saran atau ketik mata pelajaran khusus Anda.</p>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {currentStep === 'SCHOOL' && (
                            <motion.div
                                key="step-school"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="space-y-6">
                                    <div className="space-y-2 relative">
                                        <label className="text-sm font-bold text-slate-700 ml-1">
                                            Nama Satuan Pendidikan (Sekolah) <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={schoolSearchQuery || data.school_display_name}
                                            onChange={e => {
                                                setSchoolSearchQuery(e.target.value);
                                                setData(prev => ({ ...prev, school_display_name: e.target.value }));
                                                setShowSchoolSuggestions(true);
                                            }}
                                            onFocus={() => setShowSchoolSuggestions(true)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-medium text-slate-900"
                                            placeholder="Cari Nama Sekolah Anda..."
                                        />
                                        {isSearchingSchools && (
                                            <div className="absolute right-4 top-[42px]">
                                                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                                            </div>
                                        )}

                                        {showSchoolSuggestions && schoolSuggestions.length > 0 && (
                                            <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-60 overflow-y-auto overflow-x-hidden p-2">
                                                {schoolSuggestions.map((s: any) => (
                                                    <button
                                                        key={s.npsn}
                                                        onClick={() => {
                                                            setData(prev => ({
                                                                ...prev,
                                                                school_display_name: s.sekolah,
                                                                school_npsn: s.npsn,
                                                                alamat: s.alamat,
                                                                provinsi: toTitleCase(s.propinsi),
                                                                kab_kota: toTitleCase(s.kabupaten_kota)
                                                            }));
                                                            setSchoolSearchQuery(s.sekolah);
                                                            setShowSchoolSuggestions(false);
                                                            
                                                            // Try to find province ID to trigger regency load
                                                            const foundProv = provinces.find(p => p.name === s.propinsi.toUpperCase());
                                                            if (foundProv) setSelectedProvinceId(foundProv.id);
                                                        }}
                                                        className="w-full text-left px-4 py-3 hover:bg-slate-50 rounded-xl transition-colors group"
                                                    >
                                                        <div className="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">{s.sekolah}</div>
                                                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                                                            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold">{s.npsn}</span>
                                                            <span className="truncate">{s.alamat}</span>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {/* Backdrop to close suggestions */}
                                        {showSchoolSuggestions && (
                                            <div className="fixed inset-0 z-40" onClick={() => setShowSchoolSuggestions(false)} />
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 ml-1">NPSN <span className="text-red-500">*</span></label>
                                            <input
                                                type="text"
                                                maxLength={8}
                                                value={data.school_npsn}
                                                onChange={e => setData(prev => ({ ...prev, school_npsn: e.target.value }))}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-medium text-slate-900"
                                                placeholder="8 digit NPSN"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 ml-1">
                                                Provinsi <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                value={selectedProvinceId}
                                                onChange={e => {
                                                    const id = e.target.value;
                                                    setSelectedProvinceId(id);
                                                    const province = provinces.find(p => p.id === id);
                                                    setData(prev => ({ 
                                                        ...prev, 
                                                        provinsi: province ? toTitleCase(province.name) : '',
                                                        kab_kota: '' // Reset city
                                                    }));
                                                }}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-medium text-slate-900"
                                            >
                                                <option value="">Pilih Provinsi</option>
                                                {provinces.map(p => (
                                                    <option key={p.id} value={p.id}>{toTitleCase(p.name)}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 ml-1">
                                                Kabupaten / Kota <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                value={regencies.find(r => toTitleCase(r.name) === data.kab_kota)?.id || ''}
                                                disabled={!selectedProvinceId || isLoadingRegions}
                                                onChange={e => {
                                                    const id = e.target.value;
                                                    const regency = regencies.find(r => r.id === id);
                                                    setData(prev => ({ ...prev, kab_kota: regency ? toTitleCase(regency.name) : '' }));
                                                }}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-medium text-slate-900 disabled:opacity-50"
                                            >
                                                <option value="">{isLoadingRegions ? 'Memuat...' : 'Pilih Kabupaten/Kota'}</option>
                                                {regencies.map(r => (
                                                    <option key={r.id} value={r.id}>{toTitleCase(r.name)}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 ml-1">
                                                Alamat Sekolah <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={data.alamat}
                                                onChange={e => setData(prev => ({ ...prev, alamat: e.target.value }))}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden transition-all font-medium text-slate-900"
                                                placeholder="Nama Jalan, No, dsb"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )
                        }

                        {
                            currentStep === 'SIGNATURE' && (
                                <motion.div
                                    key="step-signature"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-6"
                                >
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 ml-1">
                                                Nama Kepala Sekolah <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={data.principal_name}
                                                onChange={e => setData(prev => ({ ...prev, principal_name: e.target.value }))}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-medium text-slate-900"
                                                placeholder="Nama Lengkap Kepala Sekolah"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-slate-700 ml-1">NIP Kepala Sekolah (Opsional)</label>
                                            <input
                                                type="text"
                                                value={data.principal_nip}
                                                onChange={e => setData(prev => ({ ...prev, principal_nip: e.target.value }))}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-medium text-slate-900"
                                                placeholder="Nomor Induk Pegawai"
                                            />
                                        </div>
                                    </div>
                                </motion.div>
                            )
                        }
                    </AnimatePresence>

                    {/* Navigation */}
                    <div className="flex items-center justify-between mt-12 pt-8 border-t border-slate-100">
                        {currentStep !== 'PROFILE' ? (
                            <button
                                onClick={handleBack}
                                className="flex items-center justify-center px-6 py-3.5 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-2xl font-bold transition-all gap-2"
                            >
                                <ChevronLeft className="w-5 h-5" /> Kembali
                            </button>
                        ) : <div />}

                        {currentStep !== 'SIGNATURE' ? (
                            <button
                                onClick={handleNext}
                                disabled={
                                    (currentStep === 'PROFILE' && (!data.full_name || !data.primary_subject)) ||
                                    (currentStep === 'SCHOOL' && (data.school_display_name.trim().length < 3 || !data.kab_kota || !data.alamat || !data.provinsi))
                                }
                                className="flex items-center justify-center px-8 py-3.5 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-2xl font-bold transition-all gap-2 shadow-lg shadow-slate-200"
                            >
                                Selanjutnya <ChevronRight className="w-5 h-5" />
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting || !data.principal_name}
                                className="flex items-center justify-center px-10 py-3.5 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-2xl font-bold transition-all gap-2 shadow-lg shadow-emerald-200"
                            >
                                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> Selesaikan Onboarding</>}
                            </button>
                        )}
                    </div>
                </div>

                {/* Footer Security Note */}
                <div className="text-center">
                    <p className="text-slate-400 text-xs font-medium uppercase tracking-widest">Data Anda dienkripsi secara aman dan hanya digunakan untuk keperluan dokumen sekolah.</p>
                </div>
            </div>
        </div>
    );
}
