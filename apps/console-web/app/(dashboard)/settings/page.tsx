'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { useWorkspace } from '@/hooks/use-workspace';
import {
    Loader2, User, School, PenTool, BookOpen,
    CheckCircle2, AlertCircle, Pencil, X, Check, LayoutTemplate
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { TeacherProfile, SchoolIdentity } from 'shared-types';
import { AnimatePresence, motion } from 'framer-motion';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

// ─── Types ───────────────────────────────────────────────────────────────────

type Toast = { type: 'success' | 'error'; message: string } | null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function SectionCard({
    icon: Icon,
    title,
    subtitle,
    children,
}: {
    icon: React.ElementType;
    title: string;
    subtitle: string;
    children: React.ReactNode;
}) {
    return (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-4 px-8 py-6 border-b border-slate-50">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                    <h2 className="font-black text-slate-900 text-base tracking-tight">{title}</h2>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">{subtitle}</p>
                </div>
            </div>
            <div className="px-8 py-6">{children}</div>
        </div>
    );
}

function Field({ label, value, editing, children }: {
    label: string;
    value: string | number | undefined;
    editing: boolean;
    children?: React.ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
            {editing ? (
                children
            ) : (
                <div className="text-slate-800 font-semibold text-sm py-2.5 px-3 bg-slate-50 rounded-xl border border-slate-100">
                    {value || <span className="text-slate-300 italic">—</span>}
                </div>
            )}
        </div>
    );
}

const inputCls = "w-full text-sm font-semibold text-slate-900 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all";

function SectionActions({ editing, saving, onEdit, onCancel, onSave }: {
    editing: boolean;
    saving: boolean;
    onEdit: () => void;
    onCancel: () => void;
    onSave: () => void;
}) {
    return (
        <div className="mt-6 pt-4 border-t border-slate-50 flex justify-end gap-2">
            {!editing ? (
                <button onClick={onEdit} className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest transition-all">
                    <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
            ) : (
                <>
                    <button onClick={onCancel} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 text-slate-400 hover:text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50">
                        <X className="w-3.5 h-3.5" /> Batal
                    </button>
                    <button onClick={onSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-100 disabled:opacity-50">
                        {saving
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Check className="w-3.5 h-3.5" />
                        }
                        {saving ? 'Menyimpan...' : 'Simpan'}
                    </button>
                </>
            )}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
    const { getToken, isLoaded: isAuthLoaded } = useAuth();
    const { user } = useUser();
    const { workspace, isLoading: wsLoading } = useWorkspace();

    const [isLoadingData, setIsLoadingData] = useState(true);
    const [toast, setToast] = useState<Toast>(null);
    const [activeTab, setActiveTab] = useState<'profile' | 'school' | 'signature' | 'prefs'>('profile');

    // Section data
    const [profile, setProfile] = useState<TeacherProfile>({
        full_name: '', nip: '', primary_subject: '', primary_grade: 4, primary_jenjang: 'SD',
    });
    const [school, setSchool] = useState<SchoolIdentity>({
        school_display_name: '', school_npsn: '', alamat: '',
        kab_kota: '', provinsi: '', principal_name: '', principal_nip: '', signature_location: '',
    });

    // Edit modes
    const [editingProfile, setEditingProfile] = useState(false);
    const [editingSchool, setEditingSchool] = useState(false);
    const [editingSignature, setEditingSignature] = useState(false);

    // Saving states
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingSchool, setSavingSchool] = useState(false);
    const [savingSignature, setSavingSignature] = useState(false);

    // Errors per section
    const [profileError, setProfileError] = useState<string | null>(null);
    const [schoolError, setSchoolError] = useState<string | null>(null);
    const [signatureError, setSignatureError] = useState<string | null>(null);

    // Draft copies for editing (cancel-safe)
    const [profileDraft, setProfileDraft] = useState<TeacherProfile>(profile);
    const [schoolDraft, setSchoolDraft] = useState<SchoolIdentity>(school);

    // Default prefs (localStorage only)
    const [prefs, setPrefs] = useState({ default_subject: '', default_grade: '4', default_semester: '1' });

    const showToast = (type: 'success' | 'error', message: string) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3000);
    };

    // ── Fetch data ────────────────────────────────────────────────────────────
    const loadData = useCallback(async () => {
        if (!workspace || !isAuthLoaded) return;
        setIsLoadingData(true);
        try {
            const token = await getToken();
            const headers = { Authorization: `Bearer ${token}` };

            const [pRes, sRes] = await Promise.all([
                fetch(`${API_BASE}/w/${workspace.id}/profile`, { headers }),
                fetch(`${API_BASE}/w/${workspace.id}/school`, { headers }),
            ]);

            if (pRes.ok) {
                const p: TeacherProfile = await pRes.json();
                setProfile(p);
                setProfileDraft(p);
            } else if (pRes.status !== 404) {
                // Prefill name from Clerk if no profile yet
                setProfile(prev => ({ ...prev, full_name: user?.fullName || '' }));
                setProfileDraft(prev => ({ ...prev, full_name: user?.fullName || '' }));
            }

            if (sRes.ok) {
                const s: SchoolIdentity = await sRes.json();
                setSchool(s);
                setSchoolDraft(s);
            }

            // Load prefs from localStorage
            const stored = localStorage.getItem('modulajar_prefs');
            if (stored) setPrefs(JSON.parse(stored));

        } catch (err) {
            console.error('Settings load error:', err);
        } finally {
            setIsLoadingData(false);
        }
    }, [workspace, isAuthLoaded, getToken, user?.fullName]);

    useEffect(() => { loadData(); }, [loadData]);

    // ── Save: Profile ─────────────────────────────────────────────────────────
    const saveProfile = async () => {
        if (!workspace) return;
        setSavingProfile(true); setProfileError(null);
        try {
            const token = await getToken();
            const res = await fetch(`${API_BASE}/w/${workspace.id}/profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(profileDraft),
            });
            if (!res.ok) {
                const e = await res.json();
                throw new Error(e.error || 'Gagal menyimpan profil guru.');
            }
            const saved: TeacherProfile = await res.json();
            setProfile(saved); setProfileDraft(saved);
            setEditingProfile(false);
            showToast('success', 'Profil guru berhasil disimpan.');
        } catch (err: unknown) {
            setProfileError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
        } finally {
            setSavingProfile(false);
        }
    };

    // ── Save: School ──────────────────────────────────────────────────────────
    const saveSchool = async () => {
        if (!workspace) return;
        setSavingSchool(true); setSchoolError(null);
        try {
            const token = await getToken();
            const res = await fetch(`${API_BASE}/w/${workspace.id}/school`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(schoolDraft),
            });
            if (!res.ok) {
                const e = await res.json();
                throw new Error(e.error || 'Gagal menyimpan identitas sekolah.');
            }
            const saved: SchoolIdentity = await res.json();
            setSchool(saved); setSchoolDraft(saved);
            setEditingSchool(false);
            showToast('success', 'Identitas sekolah berhasil disimpan.');
        } catch (err: unknown) {
            setSchoolError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
        } finally {
            setSavingSchool(false);
        }
    };

    // ── Save: Signature ───────────────────────────────────────────────────────
    const saveSignature = async () => {
        if (!workspace) return;
        setSavingSignature(true); setSignatureError(null);
        try {
            const token = await getToken();
            // Merge signature fields into the existing school record
            const res = await fetch(`${API_BASE}/w/${workspace.id}/school`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ ...school, ...schoolDraft }),
            });
            if (!res.ok) {
                const e = await res.json();
                throw new Error(e.error || 'Gagal menyimpan data penandatangan.');
            }
            const saved: SchoolIdentity = await res.json();
            setSchool(saved); setSchoolDraft(saved);
            setEditingSignature(false);
            showToast('success', 'Data penandatangan berhasil disimpan.');
        } catch (err: unknown) {
            setSignatureError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
        } finally {
            setSavingSignature(false);
        }
    };

    // ── Save: Prefs ───────────────────────────────────────────────────────────
    const savePrefs = () => {
        localStorage.setItem('modulajar_prefs', JSON.stringify(prefs));
        showToast('success', 'Preferensi default disimpan.');
    };

    // ── Loading ───────────────────────────────────────────────────────────────
    if (!isAuthLoaded || wsLoading || isLoadingData) {
        return (
            <div className="max-w-4xl mx-auto py-12 space-y-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white rounded-3xl border border-slate-100 h-40 animate-pulse" />
                ))}
            </div>
        );
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="max-w-4xl mx-auto py-8 space-y-8 animate-in fade-in duration-500">

            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Pengaturan</h1>
                    <p className="text-slate-500 font-medium mt-1">Kelola identitas dokumen, sekolah, dan preferensi generasi.</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-2xl w-fit">
                    {(['profile', 'school', 'signature', 'prefs'] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setActiveTab(t)}
                            className={cn(
                                "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                activeTab === t 
                                    ? "bg-white text-slate-900 shadow-sm"
                                    : "text-slate-400 hover:text-slate-600"
                            )}
                        >
                            {t === 'profile' ? 'Profil' : t === 'school' ? 'Sekolah' : t === 'signature' ? 'TTD' : 'Lainnya'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Toast */}
            {toast && (
                <div className={cn(
                    'fixed top-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-bold animate-in slide-in-from-top-4 duration-300',
                    toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-500 text-white'
                )}>
                    {toast.type === 'success'
                        ? <CheckCircle2 className="w-4 h-4" />
                        : <AlertCircle className="w-4 h-4" />
                    }
                    {toast.message}
                </div>
            )}

            <div className="relative min-h-[400px]">
                <AnimatePresence mode="wait">
                    {activeTab === 'profile' && (
                        <motion.div
                            key="profile"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                        >
                            <SectionCard icon={User} title="Profil Guru" subtitle="Nama dan mata pelajaran utama yang akan tercantum di dokumen.">
                                {profileError && (
                                    <div className="mb-4 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100 flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 shrink-0" /> {profileError}
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <Field label="Nama Lengkap" value={profile.full_name} editing={editingProfile}>
                                            <input className={inputCls} value={profileDraft.full_name}
                                                onChange={e => setProfileDraft(p => ({ ...p, full_name: e.target.value }))} />
                                        </Field>
                                    </div>
                                    <Field label="NIP (Opsional)" value={profile.nip} editing={editingProfile}>
                                        <input className={inputCls} value={profileDraft.nip}
                                            onChange={e => setProfileDraft(p => ({ ...p, nip: e.target.value }))} />
                                    </Field>
                                    <Field label="Mata Pelajaran Utama" value={profile.primary_subject} editing={editingProfile}>
                                        <input className={inputCls} value={profileDraft.primary_subject}
                                            onChange={e => setProfileDraft(p => ({ ...p, primary_subject: e.target.value }))} />
                                    </Field>
                                    <Field label="Kelas Utama" value={`Kelas ${profile.primary_grade}`} editing={editingProfile}>
                                        <select className={inputCls} value={profileDraft.primary_grade}
                                            onChange={e => setProfileDraft(p => ({ ...p, primary_grade: parseInt(e.target.value) }))}>
                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(g => (
                                                <option key={g} value={g}>Kelas {g}</option>
                                            ))}
                                        </select>
                                    </Field>
                                </div>
                                <SectionActions
                                    editing={editingProfile}
                                    saving={savingProfile}
                                    onEdit={() => { setProfileDraft(profile); setEditingProfile(true); setProfileError(null); }}
                                    onCancel={() => { setEditingProfile(false); setProfileDraft(profile); setProfileError(null); }}
                                    onSave={saveProfile}
                                />
                            </SectionCard>
                        </motion.div>
                    )}

                    {activeTab === 'school' && (
                        <motion.div
                            key="school"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                        >
                            <SectionCard icon={School} title="Identitas Sekolah" subtitle="Nama dan lokasi sekolah untuk kepala dokumen.">
                                {schoolError && (
                                    <div className="mb-4 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100 flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 shrink-0" /> {schoolError}
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <Field label="Nama Satuan Pendidikan" value={school.school_display_name} editing={editingSchool}>
                                            <input className={inputCls} value={schoolDraft.school_display_name}
                                                onChange={e => setSchoolDraft(p => ({ ...p, school_display_name: e.target.value }))} />
                                        </Field>
                                    </div>
                                    <Field label="NPSN (Opsional)" value={school.school_npsn} editing={editingSchool}>
                                        <input className={inputCls} maxLength={8} value={schoolDraft.school_npsn}
                                            onChange={e => setSchoolDraft(p => ({ ...p, school_npsn: e.target.value }))} />
                                    </Field>
                                    <Field label="Provinsi" value={school.provinsi} editing={editingSchool}>
                                        <input className={inputCls} value={schoolDraft.provinsi}
                                            onChange={e => setSchoolDraft(p => ({ ...p, provinsi: e.target.value }))} />
                                    </Field>
                                    <Field label="Kabupaten / Kota" value={school.kab_kota} editing={editingSchool}>
                                        <input className={inputCls} value={schoolDraft.kab_kota}
                                            onChange={e => setSchoolDraft(p => ({ ...p, kab_kota: e.target.value }))} />
                                    </Field>
                                    <div className="col-span-2">
                                        <Field label="Alamat Sekolah" value={school.alamat} editing={editingSchool}>
                                            <input className={inputCls} value={schoolDraft.alamat}
                                                onChange={e => setSchoolDraft(p => ({ ...p, alamat: e.target.value }))} />
                                        </Field>
                                    </div>
                                </div>
                                <SectionActions
                                    editing={editingSchool}
                                    saving={savingSchool}
                                    onEdit={() => { setSchoolDraft(school); setEditingSchool(true); setSchoolError(null); }}
                                    onCancel={() => { setEditingSchool(false); setSchoolDraft(school); setSchoolError(null); }}
                                    onSave={saveSchool}
                                />
                            </SectionCard>
                        </motion.div>
                    )}

                    {activeTab === 'signature' && (
                        <motion.div
                            key="signature"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                        >
                            <SectionCard icon={PenTool} title="Penandatangan Dokumen" subtitle="Data kepala sekolah yang muncul di blok tanda tangan.">
                                {signatureError && (
                                    <div className="mb-4 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100 flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 shrink-0" /> {signatureError}
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <Field label="Nama Kepala Sekolah" value={school.principal_name} editing={editingSignature}>
                                            <input className={inputCls} value={schoolDraft.principal_name}
                                                onChange={e => setSchoolDraft(p => ({ ...p, principal_name: e.target.value }))} />
                                        </Field>
                                    </div>
                                    <Field label="NIP Kepala Sekolah (Opsional)" value={school.principal_nip} editing={editingSignature}>
                                        <input className={inputCls} value={schoolDraft.principal_nip}
                                            onChange={e => setSchoolDraft(p => ({ ...p, principal_nip: e.target.value }))} />
                                    </Field>
                                    <Field label="Kota Penandatanganan" value={school.signature_location} editing={editingSignature}>
                                        <input className={inputCls} value={schoolDraft.signature_location}
                                            onChange={e => setSchoolDraft(p => ({ ...p, signature_location: e.target.value }))} />
                                    </Field>
                                </div>

                                {/* Signature preview */}
                                {!editingSignature && (school.principal_name || school.signature_location) && (
                                    <div className="mt-6 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-center text-xs text-slate-500 space-y-0.5">
                                        <p className="text-slate-400 uppercase tracking-widest text-[10px] font-black mb-2">Preview Blok Tanda Tangan</p>
                                        <p>{school.signature_location || '—'}, _____________</p>
                                        <p className="font-bold">Kepala Sekolah,</p>
                                        <p className="mt-6 font-bold text-slate-700">{school.principal_name || '—'}</p>
                                        {school.principal_nip && <p>NIP. {school.principal_nip}</p>}
                                    </div>
                                )}

                                <SectionActions
                                    editing={editingSignature}
                                    saving={savingSignature}
                                    onEdit={() => { setSchoolDraft(school); setEditingSignature(true); setSignatureError(null); }}
                                    onCancel={() => { setEditingSignature(false); setSchoolDraft(school); setSignatureError(null); }}
                                    onSave={saveSignature}
                                />
                            </SectionCard>
                        </motion.div>
                    )}

                    {activeTab === 'prefs' && (
                        <motion.div
                            key="prefs"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="space-y-6"
                        >
                            <SectionCard icon={BookOpen} title="Preferensi Default" subtitle="Nilai awal yang otomatis diisi saat membuka wizard generasi.">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2 space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mata Pelajaran Default</label>
                                        <select className={inputCls} value={prefs.default_subject}
                                            onChange={e => setPrefs(p => ({ ...p, default_subject: e.target.value }))}>
                                            <option value="">Tidak ada default</option>
                                            {['Matematika', 'Bahasa Indonesia', 'Bahasa Inggris', 'IPAS', 'PPKn', 'PJOK', 'Seni Budaya'].map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Semester Default</label>
                                        <select className={inputCls} value={prefs.default_semester}
                                            onChange={e => setPrefs(p => ({ ...p, default_semester: e.target.value }))}>
                                            <option value="1">Ganjil (1)</option>
                                            <option value="2">Genap (2)</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <button onClick={savePrefs} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all">
                                        Simpan Preferensi
                                    </button>
                                </div>
                                <p className="mt-3 text-[11px] text-slate-400 font-medium">
                                    * Preferensi ini disimpan di browser dan dipakai sebagai nilai awal di Wizard Generasi.
                                </p>
                            </SectionCard>

                            <SectionCard
                                icon={LayoutTemplate}
                                title="Kop Surat & Identitas Visual"
                                subtitle="Atur logo dan tata letak kop surat untuk dokumen PDF."
                            >
                                <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white rounded-xl border border-slate-200 flex items-center justify-center shadow-sm">
                                            <LayoutTemplate className="w-6 h-6 text-indigo-600" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900 text-sm">Editor Kop Surat</p>
                                            <p className="text-xs text-slate-500 font-medium">Logo, Nama Yayasan, dan Alamat Dokumen.</p>
                                        </div>
                                    </div>
                                    <Link
                                        href="/workspace/letterhead"
                                        className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm"
                                    >
                                        Buka Editor
                                    </Link>
                                </div>
                            </SectionCard>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
